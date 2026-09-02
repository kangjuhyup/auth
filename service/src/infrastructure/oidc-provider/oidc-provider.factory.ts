import { createPrivateKey } from 'node:crypto';
import { isIP } from 'node:net';
import type { EntityManager } from '@mikro-orm/core';
import type Redis from 'ioredis';
import type Provider from 'oidc-provider';
import { ConfigService } from '@nestjs/config';
import { buildOidcConfiguration } from './oidc-provider.config';
import { ClientQueryPort } from '@application/queries/ports/client-query.port';
import { UserQueryPort } from '@application/queries/ports/user-query.port';
import { loadOidcProviderConstructor } from './oidc-provider.loader';
import type {
  ClientAuthPolicyRepository,
  ClientRepository,
  EventRepository,
  JwksKeyRepository,
  TenantRepository,
  TenantConfigRepository,
  CustomGrantRepository,
} from '@domain/repositories';
import type { SymmetricCryptoPort } from '@application/ports/symmetric-crypto.port';
import type { JwksKeyCryptoPort } from '@application/ports/jwks-key-crypto.port';
import { JwksKeyModel } from '@domain/models/jwks-key';
import { EventModel } from '@domain/models/event';
import { GrantTypeRegistryPort } from '@application/ports/grant-type-registry.port';
import { registerCustomGrantTypes } from './custom-grants/register-custom-grant-types';
import { registerOidcResourceIndicatorNormalization } from './oidc-resource-indicator.middleware';
import { CUSTOM_GRANT_TYPES } from './custom-grants';
import { resolveCustomGrantDefinitions } from './custom-grants/custom-grant-metadata';
import { ScopeRegistryPort } from '@application/ports/scope-registry.port';
import { ScopeClaimResolverPort } from '@application/ports/scope-claim-resolver.port';
import { OperationalMetricsPort } from '@application/ports/operational-metrics.port';
import { RefreshTokenReuseStore } from './refresh-token-reuse.store';
import type { OidcAdapterDriver } from './adapters/oidc-adapter.constants';

export type CreateOidcProviderParams = {
  issuer: string;
  em: EntityManager;
  redis: Redis;
  userQuery: UserQueryPort;
  clientQuery: ClientQueryPort;
  configService: ConfigService;
  tenantCode: string;
  clientRepository: ClientRepository;
  clientAuthPolicyRepository: ClientAuthPolicyRepository;
  tenantRepository: TenantRepository;
  tenantConfigRepository: TenantConfigRepository;
  jwksKeyRepository: JwksKeyRepository;
  eventRepository: EventRepository;
  customGrantRepository: CustomGrantRepository;
  jwksKeyCrypto: JwksKeyCryptoPort;
  symmetricCrypto: SymmetricCryptoPort;
  grantTypeRegistry: GrantTypeRegistryPort;
  scopeRegistry: ScopeRegistryPort;
  scopeClaimResolver: ScopeClaimResolverPort;
  metrics: OperationalMetricsPort;
};

const DEFAULT_ACCESS_TOKEN_TTL = 60 * 60;
const DEFAULT_REFRESH_TOKEN_TTL = 14 * 24 * 60 * 60;
const EVENT_RESOURCE_ID_MAX_LENGTH = 191;
const EVENT_USER_AGENT_MAX_LENGTH = 255;
const EVENT_CORRELATION_ID_MAX_LENGTH = 128;

export async function createOidcProvider(
  params: CreateOidcProviderParams,
): Promise<Provider> {
  const tenant = await params.tenantRepository.findByCode(params.tenantCode);
  if (!tenant) {
    throw new Error('OIDC tenant not found');
  }
  const tenantConfig = await params.tenantConfigRepository.findByTenantId(
    tenant.id,
  );

  // Load (or auto-generate) JWKS signing keys for this tenant
  let keyModels = await params.jwksKeyRepository.findActiveByTenantId(
    tenant.id,
  );

  if (keyModels.length === 0) {
    const generated = await params.jwksKeyCrypto.generateKeyPair('RS256');
    const newKey = new JwksKeyModel({
      kid: generated.kid,
      tenantId: tenant.id,
      algorithm: generated.algorithm,
      publicKey: generated.publicKeyPem,
      privateKeyEnc: generated.privateKeyEncrypted,
      status: 'active',
      createdAt: new Date(),
    });
    await params.jwksKeyRepository.save(newKey);
    keyModels = [newKey];
  }

  const jwksKeys = keyModels.map((km) => {
    const privatePem = params.symmetricCrypto.decrypt(km.privateKeyEnc);
    const keyObj = createPrivateKey(privatePem);
    const jwk = keyObj.export({ format: 'jwk' }) as Record<string, unknown>;
    return { ...jwk, kid: km.kid, alg: km.algorithm, use: 'sig' };
  });

  const configuration = buildOidcConfiguration({
    em: params.em,
    redis: params.redis,
    userQuery: params.userQuery,
    clientQuery: params.clientQuery,
    configService: params.configService,
    tenantId: tenant.id,
    tenantCode: params.tenantCode,
    clientRepository: params.clientRepository,
    clientAuthPolicyRepository: params.clientAuthPolicyRepository,
    tenantRepository: params.tenantRepository,
    symmetricCrypto: params.symmetricCrypto,
    jwksKeys,
    supportedGrantTypes: await params.grantTypeRegistry.listSupportedGrantTypes(
      tenant.id,
    ),
    supportedScopes: await params.scopeRegistry.listSupportedScopes(tenant.id),
    scopeRegistry: params.scopeRegistry,
    scopeClaimResolver: params.scopeClaimResolver,
    tenantAccessTokenTtlSec:
      tenantConfig?.accessTokenTtlSec ?? DEFAULT_ACCESS_TOKEN_TTL,
    tenantRefreshTokenTtlSec:
      tenantConfig?.refreshTokenTtlSec ?? DEFAULT_REFRESH_TOKEN_TTL,
  });

  const Provider = await loadOidcProviderConstructor();

  const provider = new Provider(params.issuer, configuration);
  registerOidcResourceIndicatorNormalization(provider);
  const refreshTokenReuseStore = new RefreshTokenReuseStore(
    tenant.id,
    params.configService.getOrThrow<string>(
      'OIDC_ADAPTER_DRIVER',
    ) as OidcAdapterDriver,
    params.em,
    params.redis,
  );
  registerCustomGrantTypes(
    provider,
    {
      tenantCode: params.tenantCode,
      configService: params.configService,
      userQuery: params.userQuery,
      clientQuery: params.clientQuery,
      eventRepository: params.eventRepository,
    },
    await resolveCustomGrantDefinitions({
      tenantId: tenant.id,
      repository: params.customGrantRepository,
      definitions: CUSTOM_GRANT_TYPES,
    }),
  );

  provider.on('grant.revoked', (ctx, grantId) => {
    if (!isRefreshTokenReuseRevocation(ctx)) return;
    const auditContext = captureRefreshTokenReuseAuditContext(ctx, grantId);
    if (!auditContext) return;
    const tokenId = getCurrentRefreshTokenId(ctx);
    if (tokenId) {
      void (async () => {
        if (!(await refreshTokenReuseStore.hasConflict(tokenId, grantId))) {
          return;
        }
        await Promise.all([
          (async () => {
            if (await refreshTokenReuseStore.claimCleanup(grantId)) {
              await refreshTokenReuseStore.revokeGrantFamily(grantId);
            }
          })(),
          (async () => {
            if (await refreshTokenReuseStore.claimAudit(tokenId)) {
              await auditRefreshTokenReuse(
                params.eventRepository,
                params.clientRepository,
                auditContext,
              );
            }
          })(),
        ]);
      })().catch(() => {
        incrementMetricSafely(
          params.metrics,
          'refresh_token_reuse_revocation_failure_total',
          { tenantCode: params.tenantCode },
        );
      });
    }
  });
  registerConcurrentRefreshTokenReuseRevocation({
    provider,
    refreshTokenReuseStore,
    eventRepository: params.eventRepository,
    clientRepository: params.clientRepository,
    metrics: params.metrics,
    tenantCode: params.tenantCode,
  });
  registerClientAuthenticationFailureAudit({
    provider,
    tenantId: tenant.id,
    tenantCode: params.tenantCode,
    clientRepository: params.clientRepository,
    eventRepository: params.eventRepository,
    metrics: params.metrics,
  });

  return provider;
}

function registerConcurrentRefreshTokenReuseRevocation(params: {
  provider: Provider;
  refreshTokenReuseStore: RefreshTokenReuseStore;
  eventRepository: EventRepository;
  clientRepository: ClientRepository;
  metrics: OperationalMetricsPort;
  tenantCode: string;
}): void {
  params.provider.on('grant.success', (ctx: any) => {
    if (!isRefreshTokenGrantRequest(ctx)) return;
    const grantId = getRefreshTokenGrantId(ctx);
    if (!grantId) return;

    void (async () => {
      if (
        (await params.refreshTokenReuseStore.hasGrantConflict(grantId)) &&
        (await params.refreshTokenReuseStore.claimCleanup(grantId))
      ) {
        await params.refreshTokenReuseStore.revokeGrantFamily(grantId);
      }
    })().catch(() => {
      incrementMetricSafely(
        params.metrics,
        'refresh_token_reuse_revocation_failure_total',
        { tenantCode: params.tenantCode },
      );
    });
  });

  params.provider.on('grant.error', (ctx: any) => {
    if (!isRefreshTokenGrantRequest(ctx)) return;
    const refreshToken = ctx?.oidc?.entities?.RefreshToken;
    const grantId = refreshToken?.grantId;
    const tokenId = refreshToken?.jti;
    if (!grantId || !tokenId || !refreshToken) return;
    const auditContext = captureRefreshTokenReuseAuditContext(ctx, grantId);

    void (async () => {
      if (
        !(await params.refreshTokenReuseStore.hasConflict(tokenId, grantId))
      ) {
        return;
      }
      await Promise.all([
        (async () => {
          if (await params.refreshTokenReuseStore.claimCleanup(grantId)) {
            await params.refreshTokenReuseStore.revokeGrantFamily(grantId);
          }
        })(),
        (async () => {
          if (
            auditContext &&
            (await params.refreshTokenReuseStore.claimAudit(tokenId))
          ) {
            await auditRefreshTokenReuse(
              params.eventRepository,
              params.clientRepository,
              auditContext,
            );
          }
        })(),
      ]);
    })().catch(() => {
      incrementMetricSafely(
        params.metrics,
        'refresh_token_reuse_revocation_failure_total',
        { tenantCode: params.tenantCode },
      );
    });
  });
}

function isRefreshTokenGrantRequest(ctx: any): boolean {
  return (
    ctx?.oidc?.route === 'token' &&
    ctx?.oidc?.params?.grant_type === 'refresh_token'
  );
}

function getRefreshTokenGrantId(ctx: any): string | null {
  const grantId =
    ctx?.oidc?.entities?.RefreshToken?.grantId ??
    ctx?.oidc?.entities?.RotatedRefreshToken?.grantId;
  return typeof grantId === 'string' && grantId.length > 0 ? grantId : null;
}

function getCurrentRefreshTokenId(ctx: any): string | null {
  const tokenId = ctx?.oidc?.entities?.RefreshToken?.jti;
  return typeof tokenId === 'string' && tokenId.length > 0 ? tokenId : null;
}

function isRefreshTokenReuseRevocation(ctx: any): boolean {
  const refreshToken = ctx?.oidc?.entities?.RefreshToken;
  return (
    ctx?.oidc?.route === 'token' &&
    ctx?.oidc?.params?.grant_type === 'refresh_token' &&
    refreshToken?.consumed === true
  );
}

async function auditRefreshTokenReuse(
  eventRepository: EventRepository,
  clientRepository: ClientRepository,
  context: RefreshTokenReuseAuditContext,
): Promise<void> {
  const client = context.publicClientId
    ? await clientRepository.findByClientId(
        context.tenantId,
        context.publicClientId,
      )
    : null;
  await eventRepository.save(
    new EventModel({
      tenantId: context.tenantId,
      userId: context.accountId,
      clientId: client?.id ?? null,
      category: 'SECURITY',
      severity: 'WARN',
      action: 'TOKEN_REVOKED',
      resourceType: 'grant',
      resourceId: truncateAuditText(
        context.grantId,
        EVENT_RESOURCE_ID_MAX_LENGTH,
      ),
      success: false,
      reason: 'RefreshTokenReuseDetected',
      ip: context.ip,
      userAgent: context.userAgent,
      correlationId: context.correlationId,
      metadata: {
        grantType: 'refresh_token',
        action: 'revoke_grant',
        rotations: context.rotations,
      },
      occurredAt: new Date(),
    }),
  );
}

type RefreshTokenReuseAuditContext = {
  tenantId: string;
  grantId: string;
  accountId: string | null;
  publicClientId: string | null;
  rotations: number | null;
  ip: Buffer | null;
  userAgent: string | null;
  correlationId: string | null;
};

function captureRefreshTokenReuseAuditContext(
  ctx: any,
  grantId: string,
): RefreshTokenReuseAuditContext | null {
  const tenantId = ctx?.req?.tenant?.id;
  if (typeof tenantId !== 'string' || tenantId.length === 0) return null;
  const refreshToken = ctx?.oidc?.entities?.RefreshToken;
  const accountId =
    typeof refreshToken?.accountId === 'string' ? refreshToken.accountId : null;
  const rotations =
    typeof refreshToken?.rotations === 'number' ? refreshToken.rotations : null;

  return {
    tenantId,
    grantId,
    accountId,
    publicClientId: getSafePublicClientId(
      ctx?.oidc?.client?.clientId ?? refreshToken?.clientId,
    ),
    rotations,
    ip: getSafeIpBuffer(ctx),
    userAgent: getSafeUserAgent(ctx),
    correlationId: getSafeCorrelationId(ctx),
  };
}

function registerClientAuthenticationFailureAudit(params: {
  provider: Provider;
  tenantId: string;
  tenantCode: string;
  clientRepository: ClientRepository;
  eventRepository: EventRepository;
  metrics: OperationalMetricsPort;
}): void {
  const observe = (endpoint: 'token' | 'introspection') => {
    return (ctx: unknown, error: unknown) => {
      if (!isInvalidClientError(error)) return;

      incrementMetricSafely(params.metrics, 'invalid_client_total', {
        tenantCode: params.tenantCode,
      });
      void auditProviderClientAuthenticationFailure({
        ...params,
        endpoint,
        ctx,
      }).catch(() => {
        incrementMetricSafely(params.metrics, 'oidc_audit_failure_total', {
          tenantCode: params.tenantCode,
        });
      });
    };
  };

  params.provider.on('grant.error', observe('token'));
  params.provider.on('introspection.error', observe('introspection'));
}

async function auditProviderClientAuthenticationFailure(params: {
  tenantId: string;
  tenantCode: string;
  endpoint: 'token' | 'introspection';
  clientRepository: ClientRepository;
  eventRepository: EventRepository;
  ctx: unknown;
}): Promise<void> {
  const ctx = params.ctx as any;
  if (ctx?.req?.tenant?.id !== params.tenantId) return;

  const publicClientId = getSafePublicClientId(
    ctx?.oidc?.client?.clientId ??
      ctx?.oidc?.params?.client_id ??
      getSafeBasicClientId(ctx?.req?.headers?.authorization),
  );
  const client = publicClientId
    ? await params.clientRepository.findByClientId(
        params.tenantId,
        publicClientId,
      )
    : null;
  const grantType = getSafePublicClientId(ctx?.oidc?.params?.grant_type);

  await params.eventRepository.save(
    new EventModel({
      tenantId: params.tenantId,
      clientId: client?.id ?? null,
      category: 'SECURITY',
      severity: 'WARN',
      action: 'ACCESS_DENIED',
      resourceType: 'oidc-client',
      resourceId: truncateAuditText(
        publicClientId,
        EVENT_RESOURCE_ID_MAX_LENGTH,
      ),
      success: false,
      reason: 'InvalidClient',
      ip: getSafeIpBuffer(ctx),
      userAgent: getSafeUserAgent(ctx),
      correlationId: getSafeCorrelationId(ctx),
      metadata: {
        tenantCode: params.tenantCode,
        endpoint: params.endpoint,
        ...(params.endpoint === 'token' && grantType ? { grantType } : {}),
      },
      occurredAt: new Date(),
    }),
  );
}

function isInvalidClientError(error: unknown): boolean {
  return (error as { error?: unknown } | null)?.error === 'invalid_client';
}

function getSafePublicClientId(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 255) {
    return null;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  return /^[\x21-\x7e]+$/.test(decoded) ? decoded : null;
}

function getSafeBasicClientId(authorization: unknown): string | null {
  if (
    typeof authorization !== 'string' ||
    authorization.length === 0 ||
    authorization.length > 4096
  ) {
    return null;
  }

  const match = /^Basic ([A-Za-z0-9+/=]+)$/i.exec(authorization);
  if (!match) return null;

  let decoded: string;
  try {
    decoded = Buffer.from(match[1], 'base64').toString('utf8');
  } catch {
    return null;
  }

  const separator = decoded.indexOf(':');
  if (separator <= 0) return null;
  return getSafePublicClientId(decoded.slice(0, separator));
}

function getSafeUserAgent(ctx: any): string | null {
  const userAgent = ctx?.get?.('user-agent');
  return truncateAuditText(userAgent, EVENT_USER_AGENT_MAX_LENGTH);
}

function getSafeCorrelationId(ctx: any): string | null {
  return truncateAuditText(
    ctx?.req?.correlationId ??
      ctx?.get?.('x-correlation-id') ??
      ctx?.get?.('x-request-id'),
    EVENT_CORRELATION_ID_MAX_LENGTH,
  );
}

function getSafeIpBuffer(ctx: any): Buffer | null {
  const candidates = [
    ctx?.ip,
    ctx?.request?.ip,
    ctx?.req?.ip,
    ctx?.req?.socket?.remoteAddress,
  ];
  const ip = candidates.find(
    (candidate) => typeof candidate === 'string' && isIP(candidate) !== 0,
  );
  return typeof ip === 'string' ? Buffer.from(ip, 'utf8') : null;
}

function truncateAuditText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  return Array.from(value).slice(0, maxLength).join('');
}

function incrementMetricSafely(
  metrics: OperationalMetricsPort,
  name: string,
  labels: { tenantCode: string },
): void {
  try {
    metrics.incrementCounter(name, labels);
  } catch {
    // Metrics must not alter provider-owned protocol responses.
  }
}
