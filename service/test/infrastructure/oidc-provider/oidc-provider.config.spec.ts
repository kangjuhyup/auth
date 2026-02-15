import type { EntityManager } from '@mikro-orm/core';
import type Redis from 'ioredis';
import { buildOidcConfiguration } from '@infrastructure/oidc-provider/oidc-provider.config';
import type { ClientQueryPort } from '@application/queries/ports/client-query.port';
import { UserQueryPort } from '@application/queries/ports/user-query.port';

describe('buildOidcConfiguration', () => {
  const makeCtx = (tenantId?: string) =>
    ({
      req: tenantId ? { tenant: { id: tenantId } } : { tenant: undefined },
    }) as any;

  const makeClient = (clientId = 'client-1') =>
    ({
      clientId,
    }) as any;

  const makeDeps = () => {
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

    return { em, redis, accountQuery: userQuery, clientQuery };
  };

  beforeEach(() => {
    jest.resetModules();
    delete process.env.OIDC_ACCESS_TOKEN_FORMAT;
    process.env.OIDC_COOKIE_KEYS = 'k1,k2';
    process.env.OIDC_ADAPTER_DRIVER = 'redis'; // adapter factory 내부 검증 회피 목적(테스트는 여기서 검증 X)
  });

  it('resourceIndicators가 enabled=true로 설정된다', () => {
    const { em, redis, accountQuery, clientQuery } = makeDeps();
    const cfg = buildOidcConfiguration({
      em,
      redis,
      userQuery: accountQuery,
      clientQuery,
    });

    expect(cfg.features?.resourceIndicators?.enabled).toBe(true);
    expect(
      typeof (cfg.features?.resourceIndicators as any).getResourceServerInfo,
    ).toBe('function');
  });

  it('tenant가 없으면 getResourceServerInfo에서 에러(missing_tenant)를 던진다', async () => {
    const { em, redis, accountQuery, clientQuery } = makeDeps();
    const cfg = buildOidcConfiguration({
      em,
      redis,
      userQuery: accountQuery,
      clientQuery,
    });

    const fn = (cfg.features?.resourceIndicators as any).getResourceServerInfo;

    await expect(
      fn(makeCtx(undefined), 'https://api.example.com', makeClient()),
    ).rejects.toThrow('missing_tenant');
  });

  it('resource가 https가 아니면 invalid_target을 던진다', async () => {
    const { em, redis, accountQuery, clientQuery } = makeDeps();
    const cfg = buildOidcConfiguration({
      em,
      redis,
      userQuery: accountQuery,
      clientQuery,
    });
    const fn = (cfg.features?.resourceIndicators as any).getResourceServerInfo;

    await expect(
      fn(makeCtx('tenant-1'), 'http://api.example.com', makeClient()),
    ).rejects.toThrow('invalid_target');
  });

  it('resource host가 localhost면 invalid_target을 던진다', async () => {
    const { em, redis, accountQuery, clientQuery } = makeDeps();
    const cfg = buildOidcConfiguration({
      em,
      redis,
      userQuery: accountQuery,
      clientQuery,
    });
    const fn = (cfg.features?.resourceIndicators as any).getResourceServerInfo;

    await expect(
      fn(makeCtx('tenant-1'), 'https://localhost:3000', makeClient()),
    ).rejects.toThrow('invalid_target');
  });

  it('allowedResources에 없으면 invalid_target을 던진다', async () => {
    const { em, redis, accountQuery, clientQuery } = makeDeps();
    clientQuery.getAllowedResources.mockResolvedValue([
      'https://other.example.com',
    ]);

    const cfg = buildOidcConfiguration({
      em,
      redis,
      userQuery: accountQuery,
      clientQuery,
    });
    const fn = (cfg.features?.resourceIndicators as any).getResourceServerInfo;

    await expect(
      fn(
        makeCtx('tenant-1'),
        'https://api.example.com',
        makeClient('client-9'),
      ),
    ).rejects.toThrow('invalid_target');

    expect(clientQuery.getAllowedResources).toHaveBeenCalledTimes(1);
  });

  it('allowedResources에 있으면 ResourceServerInfo를 반환한다 (accessTokenFormat 포함)', async () => {
    process.env.OIDC_ACCESS_TOKEN_FORMAT = 'jwt';

    const { em, redis, accountQuery, clientQuery } = makeDeps();
    clientQuery.getAllowedResources.mockResolvedValue([
      'https://api.example.com',
    ]);

    const cfg = buildOidcConfiguration({
      em,
      redis,
      userQuery: accountQuery,
      clientQuery,
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
    // scope 고정
    expect(info.scope).toBe('openid profile email');
  });

  it('findAccount: tenant가 없으면 missing_tenant를 던진다', async () => {
    const { em, redis, accountQuery, clientQuery } = makeDeps();
    const cfg = buildOidcConfiguration({
      em,
      redis,
      userQuery: accountQuery,
      clientQuery,
    });

    await expect(
      cfg.findAccount!(makeCtx(undefined), 'user-1'),
    ).rejects.toThrow('missing_tenant');
  });

  it('findAccount: 계정 조회가 안되면 account_not_found를 던진다', async () => {
    const { em, redis, accountQuery, clientQuery } = makeDeps();
    accountQuery.findClaimsBySub.mockResolvedValue(null as any);

    const cfg = buildOidcConfiguration({
      em,
      redis,
      userQuery: accountQuery,
      clientQuery,
    });

    await expect(
      cfg.findAccount!(makeCtx('tenant-1'), 'user-1'),
    ).rejects.toThrow('account_not_found');
  });

  it('findAccount: 정상일 때 accountId와 claims 함수를 반환한다', async () => {
    const { em, redis, accountQuery, clientQuery } = makeDeps();
    accountQuery.findClaimsBySub.mockResolvedValue({
      sub: 'user-1',
      email: 'u@example.com',
      email_verified: true,
    } as any);

    const cfg = buildOidcConfiguration({
      em,
      redis,
      userQuery: accountQuery,
      clientQuery,
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

  it('OIDC_ACCESS_TOKEN_FORMAT이 없으면 accessTokenFormat은 opaque다', async () => {
    delete process.env.OIDC_ACCESS_TOKEN_FORMAT;

    const { em, redis, accountQuery, clientQuery } = makeDeps();
    clientQuery.getAllowedResources.mockResolvedValue([
      'https://api.example.com',
    ]);

    const cfg = buildOidcConfiguration({
      em,
      redis,
      userQuery: accountQuery,
      clientQuery,
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
    process.env.OIDC_ACCESS_TOKEN_FORMAT = 'jwt';

    const { em, redis, accountQuery, clientQuery } = makeDeps();
    clientQuery.getAllowedResources.mockResolvedValue([
      'https://api.example.com',
    ]);

    const cfg = buildOidcConfiguration({
      em,
      redis,
      userQuery: accountQuery,
      clientQuery,
    });
    const fn = (cfg.features?.resourceIndicators as any).getResourceServerInfo;

    const info = await fn(
      makeCtx('tenant-1'),
      'https://api.example.com',
      makeClient('client-1'),
    );

    expect(info.accessTokenFormat).toBe('jwt');
  });
});
