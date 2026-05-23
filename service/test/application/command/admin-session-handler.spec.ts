import { AdminSessionHandler } from '@application/commands/handlers/admin-session.handler';

describe('AdminSessionHandler', () => {
  let handler: AdminSessionHandler;
  let tenantRepo: any;
  let userQuery: any;
  let adminQuery: any;
  let tokenPort: any;

  beforeEach(() => {
    tenantRepo = {
      findByCode: jest.fn().mockResolvedValue({ id: 'tenant-1' }),
    };
    userQuery = {
      authenticate: jest.fn().mockResolvedValue({ userId: 'user-1' }),
    };
    adminQuery = {
      getUserRoles: jest.fn().mockResolvedValue([{ code: 'SUPER_ADMIN' }]),
    };
    tokenPort = {
      issue: jest.fn().mockResolvedValue('access-token'),
      verify: jest.fn().mockResolvedValue({ userId: 'user-1' }),
    };

    handler = new AdminSessionHandler(
      tenantRepo,
      userQuery,
      adminQuery,
      tokenPort,
    );
  });

  it('관리자 인증과 역할 검증 후 토큰 발급을 위임한다', async () => {
    const result = await handler.issueAdminToken({
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
    expect(tokenPort.issue).toHaveBeenCalledWith({
      tenantCode: 'master',
      userId: 'user-1',
    });
    expect(result).toEqual({
      token: 'access-token',
      username: 'admin',
    });
  });

  it('SUPER_ADMIN 역할이 없으면 토큰을 발급하지 않는다', async () => {
    adminQuery.getUserRoles.mockResolvedValue([{ code: 'USER' }]);

    await expect(
      handler.issueAdminToken({ username: 'admin', password: 'secret' }),
    ).resolves.toBeNull();

    expect(tokenPort.issue).not.toHaveBeenCalled();
  });

  it('관리자 토큰 검증 후 SUPER_ADMIN 역할을 확인한다', async () => {
    await expect(handler.verifyAdminToken('valid-token')).resolves.toBe(true);

    expect(tokenPort.verify).toHaveBeenCalledWith({
      tenantCode: 'master',
      token: 'valid-token',
    });
    expect(adminQuery.getUserRoles).toHaveBeenCalledWith('tenant-1', 'user-1');
  });

  it('토큰 검증 실패 시 false를 반환한다', async () => {
    tokenPort.verify.mockResolvedValue(null);

    await expect(handler.verifyAdminToken('invalid-token')).resolves.toBe(
      false,
    );
  });
});
