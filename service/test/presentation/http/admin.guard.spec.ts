import { AdminGuard } from '@presentation/http/admin.guard';
import { ADMIN_SESSION_COOKIE_NAME } from '@presentation/http/admin-session-cookie';
import type { ExecutionContext } from '@nestjs/common';

function makeContext(req: any): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => req }) } as any;
}

function makeAdminSession(result: boolean) {
  return {
    getAdminSession: jest
      .fn()
      .mockResolvedValue(
        result ? { userId: 'user-1', username: 'admin' } : null,
      ),
  };
}

describe('AdminGuard', () => {
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    debugSpy = jest.spyOn(console, 'debug').mockImplementation();
  });

  afterEach(() => {
    debugSpy.mockRestore();
  });

  it('Authorization 헤더가 없으면 false를 반환한다', async () => {
    const adminSession = makeAdminSession(true);
    const guard = new AdminGuard(adminSession as any);

    const result = await guard.canActivate(makeContext({ headers: {} }));

    expect(result).toBe(false);
    expect(adminSession.getAdminSession).not.toHaveBeenCalled();
  });

  it('Bearer 형식이 아니면 false를 반환한다', async () => {
    const adminSession = makeAdminSession(true);
    const guard = new AdminGuard(adminSession as any);

    const result = await guard.canActivate(
      makeContext({ headers: { authorization: 'Basic abc' } }),
    );

    expect(result).toBe(false);
    expect(adminSession.getAdminSession).not.toHaveBeenCalled();
  });

  it('AdminSessionPort가 false를 반환하면 false를 반환한다', async () => {
    const adminSession = makeAdminSession(false);
    const guard = new AdminGuard(adminSession as any);

    const result = await guard.canActivate(
      makeContext({ headers: { authorization: 'Bearer invalid-token' } }),
    );

    expect(adminSession.getAdminSession).toHaveBeenCalledWith('invalid-token');
    expect(result).toBe(false);
    expect(JSON.stringify(debugSpy.mock.calls)).not.toContain('invalid-token');
  });

  it('AdminSessionPort가 true를 반환하면 true를 반환한다', async () => {
    const adminSession = makeAdminSession(true);
    const guard = new AdminGuard(adminSession as any);

    const result = await guard.canActivate(
      makeContext({ headers: { authorization: 'Bearer valid-token' } }),
    );

    expect(adminSession.getAdminSession).toHaveBeenCalledWith('valid-token');
    expect(result).toBe(true);
  });

  it('admin session cookie가 있으면 cookie token으로 검증한다', async () => {
    const adminSession = makeAdminSession(true);
    const guard = new AdminGuard(adminSession as any);

    const result = await guard.canActivate(
      makeContext({
        headers: { cookie: `${ADMIN_SESSION_COOKIE_NAME}=cookie-token` },
      }),
    );

    expect(adminSession.getAdminSession).toHaveBeenCalledWith('cookie-token');
    expect(result).toBe(true);
  });

  it('AdminSessionPort 오류가 발생하면 false를 반환한다', async () => {
    const adminSession = {
      getAdminSession: jest.fn().mockRejectedValue(new Error('provider error')),
    };
    const guard = new AdminGuard(adminSession as any);

    const result = await guard.canActivate(
      makeContext({ headers: { authorization: 'Bearer valid-token' } }),
    );

    expect(result).toBe(false);
  });
});
