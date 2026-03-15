import { TenantMiddleware } from '@presentation/http/tenant.middleware';
import type { TenantRepository } from '@domain/repositories/tenant.repository';
import { TenantModel } from '@domain/models/tenant';
import { NotFoundException, BadRequestException } from '@nestjs/common';

function createMockRepository(): jest.Mocked<TenantRepository> {
  return {
    findByCode: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(null),
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    save: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockRequest(tenantCode?: string | string[]) {
  return {
    params: { tenantCode },
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
    const req = createMockRequest('acme');

    await middleware.use(req, createMockResponse(), next);

    expect(repository.findByCode).toHaveBeenCalledWith('acme');
    expect(req.tenant).toBe(tenant);
    expect(next).toHaveBeenCalled();
  });

  it('tenantCode가 없으면 NotFoundException을 던진다', async () => {
    const req = createMockRequest(undefined);

    await expect(
      middleware.use(req, createMockResponse(), next),
    ).rejects.toThrow(NotFoundException);
    expect(next).not.toHaveBeenCalled();
  });

  it('tenantCode가 배열이면 BadRequestException을 던진다', async () => {
    const req = createMockRequest(['acme', 'beta']);

    await expect(
      middleware.use(req, createMockResponse(), next),
    ).rejects.toThrow(BadRequestException);
    expect(next).not.toHaveBeenCalled();
  });

  it('테넌트가 존재하지 않으면 NotFoundException을 던진다', async () => {
    repository.findByCode.mockResolvedValue(null);
    const req = createMockRequest('unknown');

    await expect(
      middleware.use(req, createMockResponse(), next),
    ).rejects.toThrow(NotFoundException);
    expect(next).not.toHaveBeenCalled();
  });

  it('테넌트가 존재하지 않을 때 에러 메시지에 tenantCode를 포함한다', async () => {
    repository.findByCode.mockResolvedValue(null);
    const req = createMockRequest('unknown-tenant');

    await expect(
      middleware.use(req, createMockResponse(), next),
    ).rejects.toThrow('unknown-tenant');
  });
});
