import { AdminSessionAdapter } from '@infrastructure/oidc-provider/admin-session.adapter';

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

describe('AdminSessionAdapter', () => {
  let adapter: AdminSessionAdapter;
  let providerBundle: ReturnType<typeof makeProvider>;
  let registry: any;
  let userQuery: any;
  let adminQuery: any;
  let tenantRepo: any;

  beforeEach(() => {
    providerBundle = makeProvider();
    registry = {
      get: jest.fn().mockResolvedValue(providerBundle.provider),
    };
    userQuery = {
      authenticate: jest.fn().mockResolvedValue({ userId: 'user-1' }),
    };
    adminQuery = {
      getUserRoles: jest.fn().mockResolvedValue([{ code: 'SUPER_ADMIN' }]),
    };
    tenantRepo = {
      findByCode: jest.fn().mockResolvedValue({ id: 'tenant-1' }),
    };

    adapter = new AdminSessionAdapter(
      registry,
      userQuery,
      adminQuery,
      tenantRepo,
    );
  });

  it('관리자 인증과 역할 검증 후 access token을 발급한다', async () => {
    const result = await adapter.issueAdminToken({
      username: 'admin',
      password: 'secret',
    });

    expect(tenantRepo.findByCode).toHaveBeenCalledWith('master');
    expect(userQuery.authenticate).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      username: 'admin',
      password: 'secret',
    });
    expect(adminQuery.getUserRoles).toHaveBeenCalledWith('tenant-1', 'user-1');
    expect(registry.get).toHaveBeenCalledWith('master');
    expect(providerBundle.clientFind).toHaveBeenCalledWith('__admin-portal__');
    expect(providerBundle.AccessToken).toHaveBeenCalledWith({
      accountId: 'user-1',
      client: providerBundle.client,
      scope: 'openid profile',
    });
    expect(result).toEqual({
      token: 'access-token',
      username: 'admin',
    });
  });

  it('SUPER_ADMIN 역할이 없으면 token을 발급하지 않는다', async () => {
    adminQuery.getUserRoles.mockResolvedValue([{ code: 'USER' }]);

    await expect(
      adapter.issueAdminToken({ username: 'admin', password: 'secret' }),
    ).resolves.toBeNull();
  });

  it('유효한 admin token이면 true를 반환한다', async () => {
    await expect(adapter.verifyAdminToken('valid-token')).resolves.toBe(true);
    expect(providerBundle.AccessToken.find).toHaveBeenCalledWith('valid-token');
  });

  it('만료된 token이면 false를 반환한다', async () => {
    providerBundle.AccessToken.find.mockResolvedValue({
      accountId: 'user-1',
      exp: Math.floor(Date.now() / 1000) - 1,
    });

    await expect(adapter.verifyAdminToken('expired-token')).resolves.toBe(
      false,
    );
  });
});
