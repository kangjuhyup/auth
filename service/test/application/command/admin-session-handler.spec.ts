import { AdminSessionHandler } from '@application/commands/handlers/admin-session.handler';

describe('AdminSessionHandler', () => {
  let handler: AdminSessionHandler;
  let tenantRepo: any;
  let userQuery: any;
  let adminQuery: any;
  let tokenPort: any;
  let loginAttemptPolicy: any;

  beforeEach(() => {
    tenantRepo = {
      findByCode: jest.fn().mockResolvedValue({ id: 'tenant-1' }),
    };
    userQuery = {
      authenticate: jest.fn().mockResolvedValue({ userId: 'user-1' }),
      findProfile: jest.fn().mockResolvedValue({
        userId: 'user-1',
        username: 'admin',
      }),
    };
    adminQuery = {
      getUserRoles: jest.fn().mockResolvedValue([{ code: 'SUPER_ADMIN' }]),
    };
    tokenPort = {
      issue: jest.fn().mockResolvedValue('access-token'),
      verify: jest.fn().mockResolvedValue({ userId: 'user-1' }),
    };
    loginAttemptPolicy = {
      consumeAttempt: jest.fn().mockResolvedValue({ allowed: true }),
      recordFailure: jest.fn().mockResolvedValue({
        failureCount: 1,
        temporarilyLocked: false,
      }),
      recordSuccess: jest.fn().mockResolvedValue(undefined),
    };

    handler = new AdminSessionHandler(
      tenantRepo,
      userQuery,
      adminQuery,
      tokenPort,
      loginAttemptPolicy,
    );
  });

  it('관리자 인증과 역할 검증 후 토큰 발급을 위임한다', async () => {
    const result = await handler.issueAdminToken({
      username: 'admin',
      password: 'secret',
      ipAddress: '203.0.113.10',
    });

    expect(tenantRepo.findByCode).toHaveBeenCalledWith('master');
    expect(loginAttemptPolicy.consumeAttempt).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      username: 'admin',
      ipAddress: '203.0.113.10',
      scope: 'admin',
    });
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
    expect(loginAttemptPolicy.recordSuccess).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      username: 'admin',
      ipAddress: '203.0.113.10',
      scope: 'admin',
    });
  });

  it('rate limit 상태면 인증을 수행하지 않고 차단 결과를 반환한다', async () => {
    loginAttemptPolicy.consumeAttempt.mockResolvedValue({
      allowed: false,
      reason: 'rate_limited',
      retryAfterSec: 60,
    });

    await expect(
      handler.issueAdminToken({ username: 'admin', password: 'secret' }),
    ).resolves.toEqual({
      blocked: true,
      reason: 'rate_limited',
      retryAfterSec: 60,
    });
    expect(userQuery.authenticate).not.toHaveBeenCalled();
  });

  it('인증 실패 시 실패 카운터를 기록한다', async () => {
    userQuery.authenticate.mockResolvedValue(null);

    await expect(
      handler.issueAdminToken({ username: 'admin', password: 'wrong' }),
    ).resolves.toBeNull();

    expect(loginAttemptPolicy.recordFailure).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      username: 'admin',
      ipAddress: undefined,
      scope: 'admin',
    });
  });

  it('관리자 인증 실패 급증으로 잠금이 발생하면 suspicious login audit을 기록한다', async () => {
    const auditRecorder = {
      recordAdminAction: jest.fn().mockResolvedValue(undefined),
    };
    handler = new AdminSessionHandler(
      tenantRepo,
      userQuery,
      adminQuery,
      tokenPort,
      loginAttemptPolicy,
      auditRecorder as any,
    );
    userQuery.authenticate.mockResolvedValue(null);
    loginAttemptPolicy.recordFailure.mockResolvedValue({
      failureCount: 5,
      temporarilyLocked: true,
      retryAfterSec: 900,
    });

    await handler.issueAdminToken({
      username: 'admin',
      password: 'wrong',
      ipAddress: '203.0.113.10',
      userAgent: 'jest',
      correlationId: 'req-1',
    });

    expect(auditRecorder.recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        category: 'SECURITY',
        severity: 'WARN',
        action: 'ACCESS_DENIED',
        resourceType: 'admin-login-risk',
        resourceId: 'admin',
        success: false,
        reason: 'FailureSpikeDetected',
        metadata: expect.objectContaining({
          source: 'admin',
          signal: 'failure_spike',
          failureCount: 5,
          retryAfterSec: 900,
        }),
        auditContext: expect.objectContaining({
          actorUsername: 'admin',
          ipAddress: '203.0.113.10',
          userAgent: 'jest',
          correlationId: 'req-1',
        }),
      }),
    );
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

  it('관리자 세션 조회 시 사용자명을 반환한다', async () => {
    await expect(handler.getAdminSession('valid-token')).resolves.toEqual({
      userId: 'user-1',
      username: 'admin',
    });

    expect(userQuery.findProfile).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      userId: 'user-1',
    });
  });

  it('토큰 검증 실패 시 false를 반환한다', async () => {
    tokenPort.verify.mockResolvedValue(null);

    await expect(handler.verifyAdminToken('invalid-token')).resolves.toBe(
      false,
    );
  });
});
