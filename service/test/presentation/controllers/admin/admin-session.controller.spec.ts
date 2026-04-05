import { UnauthorizedException } from '@nestjs/common';
import { AdminSessionController } from '@presentation/controllers/admin/session.controller';
import { TenantModel } from '@domain/models/tenant';

function makeTenant(id = 'tenant-1', code = 'master'): TenantModel {
  const tenant = new TenantModel({ code, name: 'Master Tenant' });
  tenant.setPersistence(id, new Date(), new Date());
  return tenant;
}

function createMockProvider() {
  const client = { client_id: '__admin-portal__' };
  const clientFind = jest.fn().mockResolvedValue(client);
  const save = jest.fn().mockResolvedValue('access-token');
  const AccessToken = jest.fn().mockImplementation(function (this: any, payload: any) {
    this.payload = payload;
    this.save = save;
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

describe('AdminSessionController', () => {
  let controller: AdminSessionController;
  let registry: any;
  let userQuery: any;
  let adminQuery: any;
  let tenantRepo: any;
  let providerBundle: ReturnType<typeof createMockProvider>;

  beforeEach(() => {
    jest.clearAllMocks();
    providerBundle = createMockProvider();
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
      findByCode: jest.fn().mockResolvedValue(makeTenant()),
    };

    controller = new AdminSessionController(
      registry,
      userQuery,
      adminQuery,
      tenantRepo,
    );
  });

  it('master tenant이 없으면 UnauthorizedException을 던진다', async () => {
    tenantRepo.findByCode.mockResolvedValue(null);

    await expect(
      controller.login({ username: 'admin', password: 'secret' }),
    ).rejects.toThrow(new UnauthorizedException('master tenant not found'));
  });

  it('인증 실패 시 UnauthorizedException을 던진다', async () => {
    userQuery.authenticate.mockResolvedValue(null);

    await expect(
      controller.login({ username: 'admin', password: 'wrong' }),
    ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
  });

  it('SUPER_ADMIN 역할이 없으면 UnauthorizedException을 던진다', async () => {
    adminQuery.getUserRoles.mockResolvedValue([{ code: 'TENANT_ADMIN' }]);

    await expect(
      controller.login({ username: 'admin', password: 'secret' }),
    ).rejects.toThrow(new UnauthorizedException('Insufficient permissions'));
  });

  it('admin-portal client가 없으면 UnauthorizedException을 던진다', async () => {
    providerBundle.clientFind.mockResolvedValue(null);

    await expect(
      controller.login({ username: 'admin', password: 'secret' }),
    ).rejects.toThrow(
      new UnauthorizedException('admin-portal client not configured'),
    );
  });

  it('정상 로그인 시 access token을 발급해 반환한다', async () => {
    const result = await controller.login({
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
    expect(providerBundle.save).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      token: 'access-token',
      username: 'admin',
    });
  });

  it('logout은 정상 종료한다', async () => {
    await expect(controller.logout()).resolves.toBeUndefined();
  });
});
