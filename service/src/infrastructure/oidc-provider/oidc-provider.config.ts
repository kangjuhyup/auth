// service/src/infrastructure/oidc-provider/oidc-provider.config.ts
import type { Configuration } from 'oidc-provider';
import type { EntityManager } from '@mikro-orm/core';
import type Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { buildOidcAdapterFactory } from './adapters/oidc-apdater.factory';
import { ClientQueryPort } from '@application/queries/ports/client-query.port';
import { UserQueryPort } from '@application/queries/ports/user-query.port';
import type { ClientRepository, TenantRepository } from '@domain/repositories';
import type { SymmetricCryptoPort } from '@application/ports/symmetric-crypto.port';

export function buildOidcConfiguration(params: {
  em: EntityManager;
  redis: Redis;
  userQuery: UserQueryPort;
  clientQuery: ClientQueryPort;
  configService: ConfigService;
  tenantCode: string;
  clientRepository: ClientRepository;
  tenantRepository: TenantRepository;
  symmetricCrypto: SymmetricCryptoPort;
}): Configuration {
  const {
    em, redis, userQuery, clientQuery, configService,
    tenantCode, clientRepository, tenantRepository, symmetricCrypto,
  } = params;

  const accessTokenFormat = configService.getOrThrow<string>(
    'OIDC_ACCESS_TOKEN_FORMAT',
  ) as 'opaque' | 'jwt';

  return {
    features: {
      devInteractions: { enabled: false },

      // ✅ JWT Access Token을 쓰려면 보통 여기(리소스 지시자)에서 포맷을 결정
      resourceIndicators: {
        enabled: true,

        // ✅ 리소스 서버별 정책(포맷 포함)
        async getResourceServerInfo(ctx, resource, client) {
          const tenant = (ctx.req as any)?.tenant;
          const tenantId = tenant?.id;

          if (!tenantId) {
            throw new Error('missing_tenant');
          }

          // 1) resource 정규화 + 안전성 검증
          const origin = normalizeResourceToOrigin(resource);

          // 2) client가 허용된 resource인지 조회해서 검증
          //    (예: accountQuery 말고 ClientQueryPort 같은 걸 두는 게 자연스러움)
          const allowed = await clientQuery.getAllowedResources({
            tenantId,
            clientId: client.clientId,
          });

          // allowed 는 ['https://api.tenant-a.com', 'https://graph.tenant-a.com'] 같은 origin 리스트라고 가정
          if (!Array.isArray(allowed) || !allowed.includes(origin)) {
            throw new Error('invalid_target');
          }

          // 3) JWT/opaque 토글
          const format = accessTokenFormat; // 'jwt' | 'opaque'

          return {
            // 핵심: 이 필드로 access token 포맷을 지정
            accessTokenFormat: format,

            // 리소스 서버의 audience 값
            audience: resource,

            // 리소스 서버별 TTL (선택)
            // accessTokenTTL: 60 * 60,

            // scope 제한
            scope: 'openid profile email',
          };
        },
      },
    },

    pkce: { required: () => true },
    scopes: ['openid', 'profile', 'email'],

    cookies: { keys: getSecretKeys(configService, 'OIDC_COOKIE_KEYS') },

    jwks: { keys: [] }, // TODO: KeyRing/JWKS 연동

    // ✅ Adapter는 "opaque 토큰 저장"만을 위한 게 아님
    // (Session/Grant/Interaction 등 provider 모델 전반 저장에 필요)
    adapter: buildOidcAdapterFactory({
      driver: configService.getOrThrow<string>('OIDC_ADAPTER_DRIVER') as any,
      em,
      redis,
      cacheTtlMarginSec: Number(configService.getOrThrow<string>('OIDC_CACHE_TTL_MARGIN_SEC')),
      negativeTtlSec: Number(configService.getOrThrow<string>('OIDC_CACHE_NEGATIVE_TTL_SEC')),
      backfillTtlSec: Number(configService.getOrThrow<string>('OIDC_CACHE_BACKFILL_TTL_SEC')),
      tenantCode,
      clientRepository,
      tenantRepository,
      symmetricCrypto,
    }),

    // ✅ findAccount: opaque/jwt 상관없이 결국 "sub"로 계정 조회
    findAccount: async (ctx, sub) => {
      const tenant = (ctx.req as any)?.tenant;
      const tenantId = tenant?.id;
      if (!tenantId) {
        throw new Error('missing_tenant');
      }

      const view = await userQuery.findClaimsBySub({
        tenantId,
        sub: String(sub),
      });
      if (!view) {
        throw new Error('account_not_found');
      }

      return {
        accountId: String(sub),
        claims: async () => ({
          sub: view.sub,
          email: view.email ?? undefined,
          email_verified: view.email_verified ?? undefined,
        }),
      };
    },

    ttl: {
      AccessToken: 60 * 60,
      AuthorizationCode: 60,
      IdToken: 60 * 60,
      RefreshToken: 14 * 24 * 60 * 60,
      Interaction: 60 * 60,
      Session: 14 * 24 * 60 * 60,
      Grant: 14 * 24 * 60 * 60,
    },
  };
}

function getSecretKeys(configService: ConfigService, envKey: string): string[] {
  const raw = configService.getOrThrow<string>(envKey);
  return raw.split(',').map((k) => k.trim());
}

function normalizeResourceToOrigin(resource: string): string {
  let url: URL;
  try {
    url = new URL(resource);
  } catch {
    throw new Error('invalid_target');
  }

  // https만 허용(개발 환경 예외는 필요 시 분기)
  if (url.protocol !== 'https:') {
    throw new Error('invalid_target');
  }

  // origin 단위로 비교
  const origin = url.origin;

  // 간단한 내부망/로컬 차단(필요하면 더 강화)
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local')) {
    throw new Error('invalid_target');
  }

  return origin;
}
