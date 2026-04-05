import { AdminGuard } from '@presentation/http/admin.guard';
import type { ExecutionContext } from '@nestjs/common';

const MASTER_TENANT_ID = 'tenant-master';

function makeRegistry(accessToken: any) {
  return {
    get: jest.fn().mockResolvedValue({
      AccessToken: { find: jest.fn().mockResolvedValue(accessToken) },
    }),
  };
}

function makeTenantRepo(id: string | null) {
  return {
    findByCode: jest.fn().mockResolvedValue(id ? { id, code: 'master' } : null),
  };
}

function makeAdminQuery(roles: { code: string }[]) {
  return { getUserRoles: jest.fn().mockResolvedValue(roles) };
}

function makeContext(req: any): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => req }) } as any;
}

function validToken() {
  return {
    accountId: 'user-1',
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
}

describe('AdminGuard', () => {
  it('Authorization 헤더가 없으면 false를 반환한다', async () => {
    const guard = new AdminGuard(
      makeRegistry(validToken()) as any,
      makeTenantRepo(MASTER_TENANT_ID) as any,
      makeAdminQuery([{ code: 'SUPER_ADMIN' }]) as any,
    );
    const result = await guard.canActivate(makeContext({ headers: {} }));
    expect(result).toBe(false);
  });

  it('Bearer 형식이 아니면 false를 반환한다', async () => {
    const guard = new AdminGuard(
      makeRegistry(validToken()) as any,
      makeTenantRepo(MASTER_TENANT_ID) as any,
      makeAdminQuery([{ code: 'SUPER_ADMIN' }]) as any,
    );
    const result = await guard.canActivate(
      makeContext({ headers: { authorization: 'Basic abc' } }),
    );
    expect(result).toBe(false);
  });

  it('master 테넌트가 없으면 false를 반환한다', async () => {
    const guard = new AdminGuard(
      makeRegistry(validToken()) as any,
      makeTenantRepo(null) as any,
      makeAdminQuery([{ code: 'SUPER_ADMIN' }]) as any,
    );
    const result = await guard.canActivate(
      makeContext({ headers: { authorization: 'Bearer some-token' } }),
    );
    expect(result).toBe(false);
  });

  it('AccessToken.find 결과가 없으면 false를 반환한다', async () => {
    const guard = new AdminGuard(
      makeRegistry(null) as any,
      makeTenantRepo(MASTER_TENANT_ID) as any,
      makeAdminQuery([{ code: 'SUPER_ADMIN' }]) as any,
    );
    const result = await guard.canActivate(
      makeContext({ headers: { authorization: 'Bearer invalid-token' } }),
    );
    expect(result).toBe(false);
  });

  it('토큰이 만료되었으면 false를 반환한다', async () => {
    const expiredToken = { accountId: 'user-1', exp: Math.floor(Date.now() / 1000) - 1 };
    const guard = new AdminGuard(
      makeRegistry(expiredToken) as any,
      makeTenantRepo(MASTER_TENANT_ID) as any,
      makeAdminQuery([{ code: 'SUPER_ADMIN' }]) as any,
    );
    const result = await guard.canActivate(
      makeContext({ headers: { authorization: 'Bearer expired-token' } }),
    );
    expect(result).toBe(false);
  });

  it('SUPER_ADMIN 역할이 없으면 false를 반환한다', async () => {
    const guard = new AdminGuard(
      makeRegistry(validToken()) as any,
      makeTenantRepo(MASTER_TENANT_ID) as any,
      makeAdminQuery([{ code: 'USER' }]) as any,
    );
    const result = await guard.canActivate(
      makeContext({ headers: { authorization: 'Bearer valid-token' } }),
    );
    expect(result).toBe(false);
  });

  it('역할이 없으면 false를 반환한다', async () => {
    const guard = new AdminGuard(
      makeRegistry(validToken()) as any,
      makeTenantRepo(MASTER_TENANT_ID) as any,
      makeAdminQuery([]) as any,
    );
    const result = await guard.canActivate(
      makeContext({ headers: { authorization: 'Bearer valid-token' } }),
    );
    expect(result).toBe(false);
  });

  it('유효한 토큰 + SUPER_ADMIN 역할이면 true를 반환한다', async () => {
    const guard = new AdminGuard(
      makeRegistry(validToken()) as any,
      makeTenantRepo(MASTER_TENANT_ID) as any,
      makeAdminQuery([{ code: 'SUPER_ADMIN' }]) as any,
    );
    const result = await guard.canActivate(
      makeContext({ headers: { authorization: 'Bearer valid-token' } }),
    );
    expect(result).toBe(true);
  });

  it('여러 역할 중 SUPER_ADMIN이 포함되면 true를 반환한다', async () => {
    const guard = new AdminGuard(
      makeRegistry(validToken()) as any,
      makeTenantRepo(MASTER_TENANT_ID) as any,
      makeAdminQuery([{ code: 'USER' }, { code: 'SUPER_ADMIN' }]) as any,
    );
    const result = await guard.canActivate(
      makeContext({ headers: { authorization: 'Bearer valid-token' } }),
    );
    expect(result).toBe(true);
  });

  it('provider 오류가 발생하면 false를 반환한다', async () => {
    const registry = { get: jest.fn().mockRejectedValue(new Error('provider error')) };
    const guard = new AdminGuard(
      registry as any,
      makeTenantRepo(MASTER_TENANT_ID) as any,
      makeAdminQuery([{ code: 'SUPER_ADMIN' }]) as any,
    );
    const result = await guard.canActivate(
      makeContext({ headers: { authorization: 'Bearer valid-token' } }),
    );
    expect(result).toBe(false);
  });
});
