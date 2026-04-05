import { AccessVerifierAdapter } from '@infrastructure/oidc-provider/access-verifier.adapter';

describe('AccessVerifierAdapter', () => {
  const makeProvider = (findImpl: any) => {
    const provider = {
      AccessToken: {
        find: jest.fn(findImpl),
      },
    };

    return {
      provider,
      registry: {
        get: jest.fn().mockResolvedValue(provider),
      },
    };
  };

  const makeTenantRepo = (code = 'acme') => ({
    findById: jest.fn().mockResolvedValue({ id: 'tenant-1', code }),
  });

  it('AccessToken.find 결과가 없으면 Unauthorized 예외', async () => {
    const { provider, registry } = makeProvider(async () => undefined);
    const adapter = new AccessVerifierAdapter(
      registry as any,
      makeTenantRepo() as any,
    );

    await expect(adapter.verify('tenant-1', 'token')).rejects.toThrow(
      'Unauthorized',
    );

    expect(provider.AccessToken.find).toHaveBeenCalledTimes(1);
  });

  it('payload.exp가 과거이면 Unauthorized 예외', async () => {
    const pastExp = Math.floor(Date.now() / 1000) - 10;

    const { provider, registry } = makeProvider(async () => ({
      payload: { exp: pastExp, sub: 'user-1', tenantId: 'tenant-1' },
    }));

    const adapter = new AccessVerifierAdapter(
      registry as any,
      makeTenantRepo() as any,
    );

    await expect(adapter.verify('tenant-1', 'token')).rejects.toThrow(
      'Unauthorized',
    );

    expect(provider.AccessToken.find).toHaveBeenCalledTimes(1);
  });

  it('payload.tenantId가 있고 tenantId가 불일치하면 Unauthorized 예외', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 60;

    const { provider, registry } = makeProvider(async () => ({
      payload: { exp: futureExp, sub: 'user-1', tenantId: 'tenant-x' },
    }));

    const adapter = new AccessVerifierAdapter(
      registry as any,
      makeTenantRepo() as any,
    );

    await expect(adapter.verify('tenant-1', 'token')).rejects.toThrow(
      'Unauthorized',
    );

    expect(provider.AccessToken.find).toHaveBeenCalledTimes(1);
  });

  it('userId를 accountId에서 우선 추출한다', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 60;

    const { provider, registry } = makeProvider(async () => ({
      accountId: 'acc-1',
      payload: {
        exp: futureExp,
        sub: 'user-should-not-be-used',
        tenantId: 'tenant-1',
      },
    }));

    const adapter = new AccessVerifierAdapter(
      registry as any,
      makeTenantRepo() as any,
    );

    const user = await adapter.verify('tenant-1', 'token');

    expect(provider.AccessToken.find).toHaveBeenCalledTimes(1);
    expect(user.userId).toBe('acc-1');
  });

  it('accountId가 없으면 payload.sub에서 userId를 추출한다', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 60;

    const { provider, registry } = makeProvider(async () => ({
      payload: { exp: futureExp, sub: 'user-1', tenantId: 'tenant-1' },
    }));

    const adapter = new AccessVerifierAdapter(
      registry as any,
      makeTenantRepo() as any,
    );

    const user = await adapter.verify('tenant-1', 'token');

    expect(provider.AccessToken.find).toHaveBeenCalledTimes(1);
    expect(user.userId).toBe('user-1');
  });

  it('payload에 exp가 없어도 유효 토큰이면 통과한다(만료체크 생략)', async () => {
    const { provider, registry } = makeProvider(async () => ({
      payload: { sub: 'user-1', tenantId: 'tenant-1' },
    }));

    const adapter = new AccessVerifierAdapter(
      registry as any,
      makeTenantRepo() as any,
    );

    const user = await adapter.verify('tenant-1', 'token');

    expect(provider.AccessToken.find).toHaveBeenCalledTimes(1);
    expect(user.userId).toBe('user-1');
  });

  it('payload가 없고 toJSON().payload에 있으면 거기서 추출한다', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 60;

    const { provider, registry } = makeProvider(async () => ({
      toJSON: () => ({
        payload: { exp: futureExp, sub: 'user-1', tenantId: 'tenant-1' },
      }),
    }));

    const adapter = new AccessVerifierAdapter(
      registry as any,
      makeTenantRepo() as any,
    );

    const user = await adapter.verify('tenant-1', 'token');

    expect(provider.AccessToken.find).toHaveBeenCalledTimes(1);
    expect(user.userId).toBe('user-1');
  });

  it('payload도 없고 toJSON() 전체가 payload 형태면 거기서 추출한다', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 60;

    const { provider, registry } = makeProvider(async () => ({
      toJSON: () => ({
        exp: futureExp,
        sub: 'user-1',
        tenantId: 'tenant-1',
        scope: 'openid',
      }),
    }));

    const adapter = new AccessVerifierAdapter(
      registry as any,
      makeTenantRepo() as any,
    );

    const user = await adapter.verify('tenant-1', 'token');

    expect(provider.AccessToken.find).toHaveBeenCalledTimes(1);
    expect(user.userId).toBe('user-1');
  });

  it('userId를 찾을 수 없으면 Unauthorized 예외', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 60;

    const { provider, registry } = makeProvider(async () => ({
      payload: { exp: futureExp, tenantId: 'tenant-1' }, // sub 없음
    }));

    const adapter = new AccessVerifierAdapter(
      registry as any,
      makeTenantRepo() as any,
    );

    await expect(adapter.verify('tenant-1', 'token')).rejects.toThrow(
      'Unauthorized',
    );

    expect(provider.AccessToken.find).toHaveBeenCalledTimes(1);
  });

  it('tenantId에 해당하는 tenant를 찾지 못하면 Unauthorized 예외', async () => {
    const { registry } = makeProvider(async () => undefined);
    const tenantRepo = {
      findById: jest.fn().mockResolvedValue(null),
    };

    const adapter = new AccessVerifierAdapter(
      registry as any,
      tenantRepo as any,
    );

    await expect(adapter.verify('tenant-1', 'token')).rejects.toThrow(
      'Unauthorized',
    );
  });
});
