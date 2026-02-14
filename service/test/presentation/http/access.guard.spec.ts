import { AccessGuard } from '@presentation/http/access.guard';
import type { ExecutionContext } from '@nestjs/common';

describe('AccessGuard', () => {
  const makeContext = (req: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    }) as any;

  it('Authorization 헤더가 없으면 false를 반환한다', async () => {
    const verifier = { verify: jest.fn() } as any;
    const guard = new AccessGuard(verifier);

    const req = {
      headers: {},
    };

    const result = await guard.canActivate(makeContext(req));

    expect(result).toBe(false);
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it('Bearer 토큰 형식이 아니면 false를 반환한다', async () => {
    const verifier = { verify: jest.fn() } as any;
    const guard = new AccessGuard(verifier);

    const req = {
      headers: {
        authorization: 'Basic abc',
      },
    };

    const result = await guard.canActivate(makeContext(req));

    expect(result).toBe(false);
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it('tenantId가 없으면 false를 반환한다', async () => {
    const verifier = { verify: jest.fn() } as any;
    const guard = new AccessGuard(verifier);

    const req = {
      headers: {
        authorization: 'Bearer token',
      },
    };

    const result = await guard.canActivate(makeContext(req));

    expect(result).toBe(false);
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it('정상 요청이면 verifier를 호출하고 true를 반환한다', async () => {
    const verify = jest.fn().mockResolvedValue({
      userId: 'user-1',
    });

    const guard = new AccessGuard({ verify } as any);

    const req: any = {
      headers: {
        authorization: 'Bearer token',
        'x-tenant-id': 'tenant-1',
      },
    };

    const result = await guard.canActivate(makeContext(req));

    expect(result).toBe(true);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(req.authUser).toEqual({ userId: 'user-1' });
  });

  it('req.tenant.id가 존재하면 헤더보다 우선한다', async () => {
    const verify = jest.fn().mockResolvedValue({
      userId: 'user-2',
    });

    const guard = new AccessGuard({ verify } as any);

    const req: any = {
      headers: {
        authorization: 'Bearer token',
        'x-tenant-id': 'tenant-from-header',
      },
      tenant: {
        id: 'tenant-from-decorator',
      },
    };

    const result = await guard.canActivate(makeContext(req));

    expect(result).toBe(true);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(req.authUser).toEqual({ userId: 'user-2' });
  });

  it('verifier가 예외를 던지면 예외가 전파된다', async () => {
    const verify = jest.fn().mockRejectedValue(new Error('Unauthorized'));
    const guard = new AccessGuard({ verify } as any);

    const req: any = {
      headers: {
        authorization: 'Bearer token',
        'x-tenant-id': 'tenant-1',
      },
    };

    await expect(guard.canActivate(makeContext(req))).rejects.toThrow(
      'Unauthorized',
    );
  });
});
