import type { EntityManager } from '@mikro-orm/core';
import type Redis from 'ioredis';
import { buildOidcConfiguration } from '@infrastructure/oidc-provider/oidc-provider.config';
import type { ClientQueryPort } from '@application/queries/ports/client-query.port';
import { UserQueryPort } from '@application/queries/ports/user-query.port';
import type { ConfigService } from '@nestjs/config';
import type {
  ClientAuthPolicyRepository,
  ClientRepository,
  TenantRepository,
} from '@domain/repositories';
import type { SymmetricCryptoPort } from '@application/ports/symmetric-crypto.port';
import type { ScopeRegistryPort } from '@application/ports/scope-registry.port';
import type { ScopeClaimResolverPort } from '@application/ports/scope-claim-resolver.port';

describe('buildOidcConfiguration', () => {
  const makeCtx = (tenantId?: string) =>
    ({
      req: tenantId ? { tenant: { id: tenantId } } : { tenant: undefined },
    }) as any;

  const makeClient = (clientId = 'client-1') =>
    ({
      clientId,
    }) as any;

  const makeConfigService = (
    overrides: Record<string, string> = {},
  ): jest.Mocked<ConfigService> => {
    const defaults: Record<string, string> = {
      OIDC_ACCESS_TOKEN_FORMAT: 'opaque',
      OIDC_COOKIE_KEYS: 'k1,k2',
      OIDC_ADAPTER_DRIVER: 'redis',
      OIDC_CACHE_TTL_MARGIN_SEC: '5',
      OIDC_CACHE_NEGATIVE_TTL_SEC: '3',
      OIDC_CACHE_BACKFILL_TTL_SEC: '60',
      ...overrides,
    };
    return {
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        if (key in defaults) return defaults[key];
        throw new Error(`Missing env: ${key}`);
      }),
    } as any;
  };

  const makeDeps = (configOverrides: Record<string, string> = {}) => {
    const em = {} as EntityManager;
    const redis = {} as Redis;

    const userQuery: jest.Mocked<UserQueryPort> = {
      findClaimsBySub: jest.fn().mockResolvedValue({
        sub: 'user-1',
        email: 'u@example.com',
        email_verified: true,
      } as any),
    } as any;

    const clientQuery: jest.Mocked<ClientQueryPort> = {
      getAllowedResources: jest
        .fn()
        .mockResolvedValue(['https://api.example.com']),
    } as any;

    const configService = makeConfigService(configOverrides);

    const clientRepository: jest.Mocked<ClientRepository> = {
      findById: jest.fn().mockResolvedValue(null),
      findByClientId: jest.fn().mockResolvedValue(null),
      list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      save: jest.fn().mockImplementation(async (client) => client),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const clientAuthPolicyRepository = {
      findByClientRefId: jest.fn().mockResolvedValue(null),
    } as any as jest.Mocked<ClientAuthPolicyRepository>;
    const tenantRepository = {} as TenantRepository;
    const symmetricCrypto = {} as SymmetricCryptoPort;
    const scopeRegistry: jest.Mocked<ScopeRegistryPort> = {
      listSupportedScopes: jest
        .fn()
        .mockResolvedValue(['openid', 'profile', 'email', 'orders:read']),
      listDefinitions: jest.fn().mockResolvedValue([
        {
          scope: 'openid',
          displayName: 'openid',
          claimKeys: [],
          builtIn: true,
          enabled: true,
        },
        {
          scope: 'profile',
          displayName: 'profile',
          claimKeys: ['profile'],
          builtIn: true,
          enabled: true,
        },
        {
          scope: 'email',
          displayName: 'email',
          claimKeys: ['email'],
          builtIn: true,
          enabled: true,
        },
        {
          scope: 'orders:read',
          displayName: 'Read orders',
          claimKeys: ['orders'],
          builtIn: false,
          enabled: true,
        },
      ]),
      validateClientScopes: jest.fn(),
    };
    const scopeClaimResolver: jest.Mocked<ScopeClaimResolverPort> = {
      resolve: jest.fn().mockImplementation(async ({ baseClaims }) => ({
        sub: baseClaims.sub,
        email: baseClaims.email,
        email_verified: baseClaims.email_verified,
      })),
    };

    return {
      tenantId: 'tenant-1',
      em,
      redis,
      userQuery,
      clientQuery,
      configService,
      clientRepository,
      clientAuthPolicyRepository,
      tenantRepository,
      symmetricCrypto,
      scopeRegistry,
      scopeClaimResolver,
      jwksKeys: [],
      supportedGrantTypes: [
        'authorization_code',
        'refresh_token',
        'client_credentials',
        'implicit',
      ],
      supportedScopes: ['openid', 'profile', 'email', 'orders:read'],
      tenantAccessTokenTtlSec: 3600,
      tenantRefreshTokenTtlSec: 86400,
    };
  };

  it('resourceIndicators가 enabled=true로 설정된다', () => {
    const deps = makeDeps();
    const cfg = buildOidcConfiguration({
      ...deps,
      tenantCode: 'acme',
    });

    expect(cfg.features?.resourceIndicators?.enabled).toBe(true);
    expect(
      typeof (cfg.features?.resourceIndicators as any).getResourceServerInfo,
    ).toBe('function');
  });

  it('같은 OP 세션에 참여한 클라이언트에 SLO를 전파하도록 back-channel logout을 활성화한다', () => {
    const deps = makeDeps();
    const cfg = buildOidcConfiguration({
      ...deps,
      tenantCode: 'acme',
    });

    expect(cfg.features?.backchannelLogout?.enabled).toBe(true);
    expect(typeof cfg.fetch).toBe('function');
  });

  it('refresh_token과 client_credentials grant를 provider 지원 목록에 포함한다', () => {
    const deps = makeDeps();
    const cfg = buildOidcConfiguration({
      ...deps,
      tenantCode: 'acme',
    });

    expect((cfg as any).grantTypes).toEqual([
      'authorization_code',
      'refresh_token',
      'client_credentials',
      'implicit',
    ]);
  });

  it('introspection과 tenant-supported client credentials를 활성화한다', () => {
    const cfg = buildOidcConfiguration({ ...makeDeps(), tenantCode: 'acme' });

    expect(cfg.features?.introspection?.enabled).toBe(true);
    expect(cfg.features?.clientCredentials?.enabled).toBe(true);
    expect(typeof cfg.features?.introspection?.allowedPolicy).toBe('function');
  });

  it('tenant가 client_credentials를 지원하지 않으면 해당 feature를 비활성화한다', () => {
    const deps = makeDeps();
    deps.supportedGrantTypes = ['authorization_code', 'refresh_token'];

    const cfg = buildOidcConfiguration({ ...deps, tenantCode: 'acme' });

    expect(cfg.features?.clientCredentials?.enabled).toBe(false);
  });

  it('access token에 안정적인 tenant_id claim만 추가한다', async () => {
    const cfg = buildOidcConfiguration({ ...makeDeps(), tenantCode: 'acme' });

    await expect(cfg.extraTokenClaims!({} as any, {} as any)).resolves.toEqual({
      tenant_id: 'tenant-1',
    });
  });

  it('tenant가 없으면 getResourceServerInfo에서 에러(missing_tenant)를 던진다', async () => {
    const deps = makeDeps();
    const cfg = buildOidcConfiguration({
      ...deps,
      tenantCode: 'acme',
    });

    const fn = (cfg.features?.resourceIndicators as any).getResourceServerInfo;

    await expect(
      fn(makeCtx(undefined), 'https://api.example.com', makeClient()),
    ).rejects.toThrow('missing_tenant');
  });

  it('resource가 https가 아니면 invalid_target을 던진다', async () => {
    const deps = makeDeps();
    const cfg = buildOidcConfiguration({
      ...deps,
      tenantCode: 'acme',
    });
    const fn = (cfg.features?.resourceIndicators as any).getResourceServerInfo;

    await expect(
      fn(makeCtx('tenant-1'), 'http://api.example.com', makeClient()),
    ).rejects.toThrow('invalid_target');
  });

  it('resource host가 localhost면 invalid_target을 던진다', async () => {
    const deps = makeDeps();
    const cfg = buildOidcConfiguration({
      ...deps,
      tenantCode: 'acme',
    });
    const fn = (cfg.features?.resourceIndicators as any).getResourceServerInfo;

    await expect(
      fn(makeCtx('tenant-1'), 'https://localhost:3000', makeClient()),
    ).rejects.toThrow('invalid_target');
  });

  it('allowedResources에 없으면 invalid_target을 던진다', async () => {
    const deps = makeDeps();
    deps.clientQuery.getAllowedResources.mockResolvedValue([
      'https://other.example.com',
    ]);

    const cfg = buildOidcConfiguration({
      ...deps,
      tenantCode: 'acme',
    });
    const fn = (cfg.features?.resourceIndicators as any).getResourceServerInfo;

    await expect(
      fn(
        makeCtx('tenant-1'),
        'https://api.example.com',
        makeClient('client-9'),
      ),
    ).rejects.toThrow('invalid_target');

    expect(deps.clientQuery.getAllowedResources).toHaveBeenCalledTimes(1);
  });

  it('allowedResources에 있으면 ResourceServerInfo를 반환한다 (accessTokenFormat 포함)', async () => {
    const deps = makeDeps({ OIDC_ACCESS_TOKEN_FORMAT: 'jwt' });

    const cfg = buildOidcConfiguration({
      ...deps,
      tenantCode: 'acme',
    });
    const fn = (cfg.features?.resourceIndicators as any).getResourceServerInfo;

    const info = await fn(
      makeCtx('tenant-1'),
      'https://api.example.com',
      makeClient('client-1'),
    );

    expect(info).toBeDefined();
    expect(info.accessTokenFormat).toBe('jwt');
    expect(info.audience).toBe('https://api.example.com');
    expect(info.scope).toBe('openid profile email orders:read');
  });

  it('findAccount: tenant가 없으면 missing_tenant를 던진다', async () => {
    const deps = makeDeps();
    const cfg = buildOidcConfiguration({
      ...deps,
      tenantCode: 'acme',
    });

    await expect(
      cfg.findAccount!(makeCtx(undefined), 'user-1'),
    ).rejects.toThrow('missing_tenant');
  });

  it('findAccount: 계정 조회가 안되면 account_not_found를 던진다', async () => {
    const deps = makeDeps();
    deps.userQuery.findClaimsBySub.mockResolvedValue(null as any);

    const cfg = buildOidcConfiguration({
      ...deps,
      tenantCode: 'acme',
    });

    await expect(
      cfg.findAccount!(makeCtx('tenant-1'), 'user-1'),
    ).rejects.toThrow('account_not_found');
  });

  it('findAccount: 정상일 때 accountId와 claims 함수를 반환한다', async () => {
    const deps = makeDeps();

    const cfg = buildOidcConfiguration({
      ...deps,
      tenantCode: 'acme',
    });

    const account = await cfg.findAccount!(makeCtx('tenant-1'), 'user-1');

    expect(account).toBeDefined();
    expect(account!.accountId).toBe('user-1');

    const claims = await account!.claims(
      'user-1',
      'openid profile email',
      {},
      [],
    );
    expect(claims.sub).toBe('user-1');
    expect(claims.email).toBe('u@example.com');
    expect(claims.email_verified).toBe(true);
    expect(deps.scopeRegistry.listDefinitions).toHaveBeenCalledWith('tenant-1');
    expect(deps.scopeClaimResolver.resolve).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        subject: 'user-1',
        requestedScopes: ['openid', 'profile', 'email'],
        claimKeys: ['profile', 'email'],
      }),
    );
  });

  it('OIDC_ACCESS_TOKEN_FORMAT=opaque이면 accessTokenFormat은 opaque다', async () => {
    const deps = makeDeps({ OIDC_ACCESS_TOKEN_FORMAT: 'opaque' });

    const cfg = buildOidcConfiguration({
      ...deps,
      tenantCode: 'acme',
    });
    const fn = (cfg.features?.resourceIndicators as any).getResourceServerInfo;

    const info = await fn(
      makeCtx('tenant-1'),
      'https://api.example.com',
      makeClient('client-1'),
    );

    expect(info.accessTokenFormat).toBe('opaque');
  });

  it('OIDC_ACCESS_TOKEN_FORMAT=jwt이면 accessTokenFormat은 jwt다', async () => {
    const deps = makeDeps({ OIDC_ACCESS_TOKEN_FORMAT: 'jwt' });

    const cfg = buildOidcConfiguration({
      ...deps,
      tenantCode: 'acme',
    });
    const fn = (cfg.features?.resourceIndicators as any).getResourceServerInfo;

    const info = await fn(
      makeCtx('tenant-1'),
      'https://api.example.com',
      makeClient('client-1'),
    );

    expect(info.accessTokenFormat).toBe('jwt');
  });

  describe('TTL fallback: client TTL 미설정 시 tenant TTL 적용', () => {
    const makeTtlCtx = (tenantId = 'tenant-1') =>
      ({ req: { tenant: { id: tenantId } } }) as any;

    const makeTtlClient = (clientId = 'client-1') => ({ clientId }) as any;

    it('AccessToken: client에 TTL이 없으면 tenantAccessTokenTtlSec를 반환한다', async () => {
      const deps = makeDeps();
      (deps.clientRepository as any).findByClientId = jest
        .fn()
        .mockResolvedValue({
          accessTokenTtlSec: null,
          refreshTokenTtlSec: null,
        });

      const cfg = buildOidcConfiguration({ ...deps, tenantCode: 'acme' });
      const ttlFn = (cfg.ttl as any).AccessToken;

      // 1차 호출: 캐시 미스 → tenantTTL 반환 + warm 트리거
      const firstResult = ttlFn(makeTtlCtx(), {}, makeTtlClient());
      expect(firstResult).toBe(deps.tenantAccessTokenTtlSec);

      // warm 완료 대기
      await Promise.resolve();

      // 2차 호출: 캐시 히트, client.access === null → tenantTTL 반환
      const secondResult = ttlFn(makeTtlCtx(), {}, makeTtlClient());
      expect(secondResult).toBe(deps.tenantAccessTokenTtlSec);
    });

    it('RefreshToken: client에 TTL이 없으면 tenantRefreshTokenTtlSec를 반환한다', async () => {
      const deps = makeDeps();
      (deps.clientRepository as any).findByClientId = jest
        .fn()
        .mockResolvedValue({
          accessTokenTtlSec: null,
          refreshTokenTtlSec: null,
        });

      const cfg = buildOidcConfiguration({ ...deps, tenantCode: 'acme' });
      const ttlFn = (cfg.ttl as any).RefreshToken;

      const firstResult = ttlFn(makeTtlCtx(), {}, makeTtlClient());
      expect(firstResult).toBe(deps.tenantRefreshTokenTtlSec);

      await Promise.resolve();

      const secondResult = ttlFn(makeTtlCtx(), {}, makeTtlClient());
      expect(secondResult).toBe(deps.tenantRefreshTokenTtlSec);
    });

    it('AccessToken: client에 TTL이 있으면 client TTL을 반환한다', async () => {
      const clientAccessTtl = 1800;
      const deps = makeDeps();
      (deps.clientRepository as any).findByClientId = jest
        .fn()
        .mockResolvedValue({
          accessTokenTtlSec: clientAccessTtl,
          refreshTokenTtlSec: null,
        });

      const cfg = buildOidcConfiguration({ ...deps, tenantCode: 'acme' });
      const ttlFn = (cfg.ttl as any).AccessToken;

      // 1차 호출: 캐시 미스 → tenantTTL 반환 + warm 트리거
      ttlFn(makeTtlCtx(), {}, makeTtlClient());

      // warm 완료 대기
      await Promise.resolve();

      // 2차 호출: 캐시 히트, client.access === 1800 → client TTL 반환
      const result = ttlFn(makeTtlCtx(), {}, makeTtlClient());
      expect(result).toBe(clientAccessTtl);
    });

    it('RefreshToken: client에 TTL이 있으면 client TTL을 반환한다', async () => {
      const clientRefreshTtl = 43200;
      const deps = makeDeps();
      (deps.clientRepository as any).findByClientId = jest
        .fn()
        .mockResolvedValue({
          accessTokenTtlSec: null,
          refreshTokenTtlSec: clientRefreshTtl,
        });

      const cfg = buildOidcConfiguration({ ...deps, tenantCode: 'acme' });
      const ttlFn = (cfg.ttl as any).RefreshToken;

      ttlFn(makeTtlCtx(), {}, makeTtlClient());
      await Promise.resolve();

      const result = ttlFn(makeTtlCtx(), {}, makeTtlClient());
      expect(result).toBe(clientRefreshTtl);
    });

    it('tenant 정보가 없으면 tenantAccessTokenTtlSec를 반환한다', () => {
      const deps = makeDeps();
      const cfg = buildOidcConfiguration({ ...deps, tenantCode: 'acme' });
      const ttlFn = (cfg.ttl as any).AccessToken;

      const result = ttlFn(
        { req: { tenant: undefined } } as any,
        {},
        makeTtlClient(),
      );
      expect(result).toBe(deps.tenantAccessTokenTtlSec);
    });
  });

  describe('refresh token rotation policy', () => {
    it('정책이 없으면 refresh token rotation을 활성화한다', async () => {
      const deps = makeDeps();
      (deps.clientRepository as any).findByClientId = jest
        .fn()
        .mockResolvedValue({ id: 'client-ref-1' });

      const cfg = buildOidcConfiguration({ ...deps, tenantCode: 'acme' });

      await expect(
        (cfg.rotateRefreshToken as any)({
          req: { tenant: { id: 'tenant-1' } },
          oidc: { client: { clientId: 'client-1' } },
        }),
      ).resolves.toBe(true);
    });

    it('클라이언트 인증 정책의 rotation 비활성화를 반영한다', async () => {
      const deps = makeDeps();
      (deps.clientRepository as any).findByClientId = jest
        .fn()
        .mockResolvedValue({ id: 'client-ref-1' });
      deps.clientAuthPolicyRepository.findByClientRefId.mockResolvedValue({
        refreshTokenRotationEnabled: false,
      } as any);

      const cfg = buildOidcConfiguration({ ...deps, tenantCode: 'acme' });

      await expect(
        (cfg.rotateRefreshToken as any)({
          req: { tenant: { id: 'tenant-1' } },
          oidc: { client: { clientId: 'client-1' } },
        }),
      ).resolves.toBe(false);

      expect(deps.clientRepository.findByClientId).toHaveBeenCalledWith(
        'tenant-1',
        'client-1',
      );
      expect(
        deps.clientAuthPolicyRepository.findByClientRefId,
      ).toHaveBeenCalledWith('client-ref-1');
    });

    it('tenant나 client가 없으면 보수적으로 rotation을 활성화한다', async () => {
      const deps = makeDeps();
      const cfg = buildOidcConfiguration({ ...deps, tenantCode: 'acme' });

      await expect(
        (cfg.rotateRefreshToken as any)({ req: {}, oidc: {} }),
      ).resolves.toBe(true);
    });
  });
});
