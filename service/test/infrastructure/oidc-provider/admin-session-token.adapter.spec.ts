import { AdminSessionTokenAdapter } from '@infrastructure/oidc-provider/admin-session-token.adapter';

function makeProvider() {
  const client = { client_id: '__admin-portal__' };
  const clientFind = jest.fn().mockResolvedValue(client);
  const save = jest.fn().mockResolvedValue('access-token');
  const AccessToken = jest.fn().mockImplementation(function (
    this: any,
    payload: any,
  ) {
    this.payload = payload;
    this.save = save;
  }) as jest.Mock & { find: jest.Mock };
  AccessToken.find = jest.fn().mockResolvedValue({
    accountId: 'user-1',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  return {
    provider: {
      Client: { find: clientFind },
      AccessToken,
    } as any,
    client,
    clientFind,
    AccessToken,
    save,
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

  it('OIDC provider access token을 발급한다', async () => {
    const token = await adapter.issue({
      tenantCode: 'master',
      userId: 'user-1',
    });

    expect(registry.get).toHaveBeenCalledWith('master');
    expect(providerBundle.clientFind).toHaveBeenCalledWith('__admin-portal__');
    expect(providerBundle.AccessToken).toHaveBeenCalledWith({
      accountId: 'user-1',
      client: providerBundle.client,
      scope: 'openid profile',
    });
    expect(token).toBe('access-token');
  });

  it('유효한 admin token이면 userId를 반환한다', async () => {
    await expect(
      adapter.verify({ tenantCode: 'master', token: 'valid-token' }),
    ).resolves.toEqual({ userId: 'user-1' });
    expect(providerBundle.AccessToken.find).toHaveBeenCalledWith('valid-token');
  });

  it('만료된 token이면 null을 반환한다', async () => {
    providerBundle.AccessToken.find.mockResolvedValue({
      accountId: 'user-1',
      exp: Math.floor(Date.now() / 1000) - 1,
    });

    await expect(
      adapter.verify({ tenantCode: 'master', token: 'expired-token' }),
    ).resolves.toBeNull();
  });
});
