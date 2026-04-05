import { TenantMiddleware } from '@presentation/http/tenant.middleware';
import type { TenantRepository } from '@domain/repositories/tenant.repository';
import { TenantModel } from '@domain/models/tenant';
import { BadRequestException, NotFoundException } from '@nestjs/common';

function createMockRepository(): jest.Mocked<TenantRepository> {
  return {
    findByCode: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(null),
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    save: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockRequest(options?: {
  tenantCode?: string | string[];
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  headers?: Record<string, unknown>;
}) {
  return {
    params: { tenantCode: options?.tenantCode },
    query: options?.query ?? {},
    body: options?.body ?? {},
    headers: options?.headers ?? {},
  } as any;
}

function createMockResponse() {
  return {} as any;
}

describe('TenantMiddleware', () => {
  let middleware: TenantMiddleware;
  let repository: jest.Mocked<TenantRepository>;
  const next = jest.fn();

  beforeEach(() => {
    repository = createMockRepository();
    middleware = new TenantMiddleware(repository);
    next.mockClear();
  });

  it('tenantCode로 테넌트를 조회하여 req.tenant에 설정한다', async () => {
    const tenant = new TenantModel({ code: 'acme', name: 'Acme' }, 'tenant-1');
    repository.findByCode.mockResolvedValue(tenant);
    const req = createMockRequest({ tenantCode: 'acme' });

    await middleware.use(req, createMockResponse(), next);

    expect(repository.findByCode).toHaveBeenCalledWith('acme');
    expect(req.tenant).toBe(tenant);
    expect(next).toHaveBeenCalled();
  });

  it('tenantCode가 없으면 BadRequestException을 던진다', async () => {
    const req = createMockRequest();

    await expect(
      middleware.use(req, createMockResponse(), next),
    ).rejects.toThrow(BadRequestException);
    expect(next).not.toHaveBeenCalled();
  });

  it('tenantCode가 배열이면 첫 번째 요소로 테넌트를 조회한다', async () => {
    const tenant = new TenantModel({ code: 'acme', name: 'Acme' }, 'tenant-1');
    repository.findByCode.mockResolvedValue(tenant);
    const req = createMockRequest({ tenantCode: ['acme', 'beta'] });

    await middleware.use(req, createMockResponse(), next);

    expect(repository.findByCode).toHaveBeenCalledWith('acme');
    expect(req.tenant).toBe(tenant);
    expect(next).toHaveBeenCalled();
  });

  it('테넌트가 존재하지 않으면 NotFoundException을 던진다', async () => {
    repository.findByCode.mockResolvedValue(null);
    const req = createMockRequest({ tenantCode: 'unknown' });

    await expect(
      middleware.use(req, createMockResponse(), next),
    ).rejects.toThrow(NotFoundException);
    expect(next).not.toHaveBeenCalled();
  });

  it('테넌트가 존재하지 않을 때 에러 메시지에 tenantCode를 포함한다', async () => {
    repository.findByCode.mockResolvedValue(null);
    const req = createMockRequest({ tenantCode: 'unknown-tenant' });

    await expect(
      middleware.use(req, createMockResponse(), next),
    ).rejects.toThrow('unknown-tenant');
  });

  it('query.tenantCode로도 테넌트를 조회할 수 있다', async () => {
    const tenant = new TenantModel({ code: 'acme', name: 'Acme' }, 'tenant-1');
    repository.findByCode.mockResolvedValue(tenant);
    const req = createMockRequest({ query: { tenantCode: 'acme' } });

    await middleware.use(req, createMockResponse(), next);

    expect(repository.findByCode).toHaveBeenCalledWith('acme');
    expect(req.tenant).toBe(tenant);
  });

  it('body.tenant_code로도 테넌트를 조회할 수 있다', async () => {
    const tenant = new TenantModel({ code: 'acme', name: 'Acme' }, 'tenant-1');
    repository.findByCode.mockResolvedValue(tenant);
    const req = createMockRequest({ body: { tenant_code: 'acme' } });

    await middleware.use(req, createMockResponse(), next);

    expect(repository.findByCode).toHaveBeenCalledWith('acme');
    expect(req.tenant).toBe(tenant);
  });

  it('x-tenant-code 헤더로도 테넌트를 조회할 수 있다', async () => {
    const tenant = new TenantModel({ code: 'acme', name: 'Acme' }, 'tenant-1');
    repository.findByCode.mockResolvedValue(tenant);
    const req = createMockRequest({ headers: { 'x-tenant-code': 'acme' } });

    await middleware.use(req, createMockResponse(), next);

    expect(repository.findByCode).toHaveBeenCalledWith('acme');
    expect(req.tenant).toBe(tenant);
  });
});
