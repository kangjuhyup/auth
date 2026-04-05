import type { EntityManager } from '@mikro-orm/core';
import type Redis from 'ioredis';
import { buildOidcConfiguration } from '@infrastructure/oidc-provider/oidc-provider.config';
import type { ClientQueryPort } from '@application/queries/ports/client-query.port';
import { UserQueryPort } from '@application/queries/ports/user-query.port';
import type { ConfigService } from '@nestjs/config';
import type { ClientRepository, TenantRepository } from '@domain/repositories';
import type { SymmetricCryptoPort } from '@application/ports/symmetric-crypto.port';

describe('buildOidcConfiguration', () => {
  const makeCtx = (tenantId?: string) =>
    ({
      req: tenantId ? { tenant: { id: tenantId } } : { tenant: undefined },
    }) as any;

  const makeClient = (clientId = 'client-1') =>
    ({
      clientId,
    }) as any;

  const makeConfigService = (overrides: Record<string, string> = {}): jest.Mocked<ConfigService> => {
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

    const clientRepository = {} as ClientRepository;
    const tenantRepository = {} as TenantRepository;
    const symmetricCrypto = {} as SymmetricCryptoPort;

    return {
      em,
      redis,
      userQuery,
      clientQuery,
      configService,
      clientRepository,
      tenantRepository,
      symmetricCrypto,
      jwksKeys: [],
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
    expect(info.scope).toBe('openid profile email');
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

    const makeTtlClient = (clientId = 'client-1') =>
      ({ clientId }) as any;

    it('AccessToken: client에 TTL이 없으면 tenantAccessTokenTtlSec를 반환한다', async () => {
      const deps = makeDeps();
      (deps.clientRepository as any).findByClientId = jest
        .fn()
        .mockResolvedValue({ accessTokenTtlSec: null, refreshTokenTtlSec: null });

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
        .mockResolvedValue({ accessTokenTtlSec: null, refreshTokenTtlSec: null });

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
        .mockResolvedValue({ accessTokenTtlSec: clientAccessTtl, refreshTokenTtlSec: null });

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
        .mockResolvedValue({ accessTokenTtlSec: null, refreshTokenTtlSec: clientRefreshTtl });

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

      const result = ttlFn({ req: { tenant: undefined } } as any, {}, makeTtlClient());
      expect(result).toBe(deps.tenantAccessTokenTtlSec);
    });
  });
});
