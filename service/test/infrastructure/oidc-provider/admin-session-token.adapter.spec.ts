import { AdminSessionTokenAdapter } from '@infrastructure/oidc-provider/admin-session-token.adapter';

function createTokenModel(savedValue: string) {
  const save = jest.fn().mockResolvedValue(savedValue);

  return {
    save,
    Model: jest.fn().mockImplementation(function (this: any, payload: any) {
      this.payload = payload;
      this.save = save;
    }) as jest.Mock & { find: jest.Mock },
  };
}

function makeProvider() {
  const client = { clientId: '__admin-portal__' };
  const clientFind = jest.fn().mockResolvedValue(client);
  const accessToken = createTokenModel('access-token');
  const refreshToken = createTokenModel('refresh-token');
  refreshToken.Model.find = jest.fn().mockResolvedValue({
    accountId: 'user-1',
    clientId: '__admin-portal__',
    scope: 'openid profile',
    exp: Math.floor(Date.now() / 1000) + 3600,
    destroy: jest.fn().mockResolvedValue(undefined),
  });
  accessToken.Model.find = jest.fn().mockResolvedValue({
    accountId: 'user-1',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  return {
    provider: {
      Client: { find: clientFind },
      AccessToken: accessToken.Model,
      RefreshToken: refreshToken.Model,
    } as any,
    client,
    clientFind,
    accessToken,
    refreshToken,
  };
}

describe('AdminSessionTokenAdapter', () => {
  let adapter: AdminSessionTokenAdapter;
  let providerBundle: ReturnType<typeof makeProvider>;
  let registry: any;

  beforeEach(() => {
    providerBundle = makeProvider();
    registry = {
      get: jest.fn().mockResolvedValue(providerBundle.provider),
    };

    adapter = new AdminSessionTokenAdapter(registry);
  });

  it('OIDC provider access/refresh token을 함께 발급한다', async () => {
    const tokens = await adapter.issue({
      tenantCode: 'master',
      userId: 'user-1',
    });

    expect(registry.get).toHaveBeenCalledWith('master');
    expect(providerBundle.clientFind).toHaveBeenCalledWith('__admin-portal__');
    expect(providerBundle.accessToken.Model).toHaveBeenCalledWith({
      accountId: 'user-1',
      client: providerBundle.client,
      scope: 'openid profile',
    });
    expect(providerBundle.refreshToken.Model).toHaveBeenCalledWith({
      accountId: 'user-1',
      client: providerBundle.client,
      scope: 'openid profile',
    });
    expect(tokens).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('refresh token을 소모하고 새 access/refresh token을 재발급한다', async () => {
    const destroy = jest.fn().mockResolvedValue(undefined);
    providerBundle.refreshToken.Model.find.mockResolvedValue({
      accountId: 'user-1',
      clientId: '__admin-portal__',
      scope: 'openid profile',
      exp: Math.floor(Date.now() / 1000) + 3600,
      destroy,
    });
    providerBundle.accessToken.save.mockResolvedValue('next-access-token');
    providerBundle.refreshToken.save.mockResolvedValue('next-refresh-token');

    await expect(
      adapter.refresh({ tenantCode: 'master', refreshToken: 'refresh-token' }),
    ).resolves.toEqual({
      accessToken: 'next-access-token',
      refreshToken: 'next-refresh-token',
      userId: 'user-1',
    });

    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('유효한 admin token이면 userId를 반환한다', async () => {
    await expect(
      adapter.verify({ tenantCode: 'master', token: 'valid-token' }),
    ).resolves.toEqual({ userId: 'user-1' });
    expect(providerBundle.accessToken.Model.find).toHaveBeenCalledWith(
      'valid-token',
    );
  });

  it('만료된 token이면 null을 반환한다', async () => {
    providerBundle.accessToken.Model.find.mockResolvedValue({
      accountId: 'user-1',
      exp: Math.floor(Date.now() / 1000) - 1,
    });

    await expect(
      adapter.verify({ tenantCode: 'master', token: 'expired-token' }),
    ).resolves.toBeNull();
  });
});
