import { createPrivateKey } from 'node:crypto';
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
import { CUSTOM_GRANT_TYPES } from './custom-grants';
import { resolveCustomGrantDefinitions } from './custom-grants/custom-grant-metadata';
import { ScopeRegistryPort } from '@application/ports/scope-registry.port';
import { ScopeClaimResolverPort } from '@application/ports/scope-claim-resolver.port';

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
};

const DEFAULT_ACCESS_TOKEN_TTL = 60 * 60;
const DEFAULT_REFRESH_TOKEN_TTL = 14 * 24 * 60 * 60;

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
    void auditRefreshTokenReuse(params.eventRepository, ctx, grantId).catch(
      () => undefined,
    );
  });

  return provider;
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
  ctx: any,
  grantId: string,
): Promise<void> {
  const tenantId = ctx?.req?.tenant?.id;
  if (!tenantId) return;

  const refreshToken = ctx?.oidc?.entities?.RefreshToken;
  await eventRepository.save(
    new EventModel({
      tenantId,
      userId: refreshToken?.accountId ?? null,
      clientId: ctx?.oidc?.client?.clientId ?? refreshToken?.clientId ?? null,
      category: 'SECURITY',
      severity: 'WARN',
      action: 'TOKEN_REVOKED',
      resourceType: 'grant',
      resourceId: grantId,
      success: false,
      reason: 'RefreshTokenReuseDetected',
      ip: null,
      userAgent: ctx?.get?.('user-agent') ?? null,
      correlationId:
        ctx?.req?.correlationId ??
        ctx?.get?.('x-correlation-id') ??
        ctx?.get?.('x-request-id') ??
        null,
      metadata: {
        grantType: 'refresh_token',
        action: 'revoke_grant',
        rotations: refreshToken?.rotations ?? null,
      },
      occurredAt: new Date(),
    }),
  );
}
