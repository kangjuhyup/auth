import { AdminGuard } from '@presentation/http/admin.guard';
import type { ExecutionContext } from '@nestjs/common';

function makeContext(req: any): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => req }) } as any;
}

function makeAdminSession(result: boolean) {
  return {
    verifyAdminToken: jest.fn().mockResolvedValue(result),
  };
}

describe('AdminGuard', () => {
  it('Authorization 헤더가 없으면 false를 반환한다', async () => {
    const adminSession = makeAdminSession(true);
    const guard = new AdminGuard(adminSession as any);

    const result = await guard.canActivate(makeContext({ headers: {} }));

    expect(result).toBe(false);
    expect(adminSession.verifyAdminToken).not.toHaveBeenCalled();
  });

  it('Bearer 형식이 아니면 false를 반환한다', async () => {
    const adminSession = makeAdminSession(true);
    const guard = new AdminGuard(adminSession as any);

    const result = await guard.canActivate(
      makeContext({ headers: { authorization: 'Basic abc' } }),
    );

    expect(result).toBe(false);
    expect(adminSession.verifyAdminToken).not.toHaveBeenCalled();
  });

  it('AdminSessionPort가 false를 반환하면 false를 반환한다', async () => {
    const adminSession = makeAdminSession(false);
    const guard = new AdminGuard(adminSession as any);

    const result = await guard.canActivate(
      makeContext({ headers: { authorization: 'Bearer invalid-token' } }),
    );

    expect(adminSession.verifyAdminToken).toHaveBeenCalledWith('invalid-token');
    expect(result).toBe(false);
  });

  it('AdminSessionPort가 true를 반환하면 true를 반환한다', async () => {
    const adminSession = makeAdminSession(true);
    const guard = new AdminGuard(adminSession as any);

    const result = await guard.canActivate(
      makeContext({ headers: { authorization: 'Bearer valid-token' } }),
    );

    expect(adminSession.verifyAdminToken).toHaveBeenCalledWith('valid-token');
    expect(result).toBe(true);
  });

  it('AdminSessionPort 오류가 발생하면 false를 반환한다', async () => {
    const adminSession = {
      verifyAdminToken: jest
        .fn()
        .mockRejectedValue(new Error('provider error')),
    };
    const guard = new AdminGuard(adminSession as any);

    const result = await guard.canActivate(
      makeContext({ headers: { authorization: 'Bearer valid-token' } }),
    );

    expect(result).toBe(false);
  });
});
