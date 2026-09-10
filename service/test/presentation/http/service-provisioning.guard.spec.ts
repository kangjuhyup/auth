import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ServiceAccessError } from '@application/ports/service-access-verifier.port';
import { ServiceProvisioningGuard } from '@presentation/http/service-provisioning.guard';

describe('ServiceProvisioningGuard', () => {
  const context = (request: any) =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
    }) as ExecutionContext;

  it('검증된 service principal을 request에 저장하고 token은 복사하지 않는다', async () => {
    const verifier = {
      verify: jest.fn().mockResolvedValue({
        clientId: 'provisioner',
        scope: 'auth.user.provision',
      }),
    };
    const request: any = {
      headers: { authorization: 'Bearer opaque-secret-token' },
      tenant: { id: 'tenant-1' },
    };
    const guard = new ServiceProvisioningGuard(verifier as any);

    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(verifier.verify).toHaveBeenCalledWith(
      'tenant-1',
      'opaque-secret-token',
    );
    expect(request.servicePrincipal).toEqual({
      clientId: 'provisioner',
      scope: 'auth.user.provision',
    });
    expect(JSON.stringify(request.servicePrincipal)).not.toContain(
      'opaque-secret-token',
    );
  });

  it('token 또는 tenant가 없으면 401이다', async () => {
    const guard = new ServiceProvisioningGuard({ verify: jest.fn() } as any);
    await expect(
      guard.canActivate(context({ headers: {}, tenant: { id: 'tenant-1' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('scope 부족은 403이고 그 외 검증 실패는 401이다', async () => {
    const verifier = { verify: jest.fn() };
    const guard = new ServiceProvisioningGuard(verifier as any);
    const request = {
      headers: { authorization: 'Bearer token' },
      tenant: { id: 'tenant-1' },
    };

    verifier.verify.mockRejectedValueOnce(
      new ServiceAccessError('insufficient_scope'),
    );
    await expect(guard.canActivate(context(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    verifier.verify.mockRejectedValueOnce(new Error('storage failure'));
    await expect(guard.canActivate(context(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
