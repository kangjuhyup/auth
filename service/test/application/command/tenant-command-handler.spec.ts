import { ConflictException, NotFoundException } from '@nestjs/common';
import { TenantCommandHandler } from '@application/commands/handlers/tenant-command.handler';
import type { TenantRepository } from '@domain/repositories';
import { TenantModel } from '@domain/models/tenant';

function makeTenant(id = 'tenant-1'): TenantModel {
  const t = new TenantModel({ code: 'acme', name: 'ACME Corp' });
  t.setPersistence(id, new Date(), new Date());
  return t;
}

function createMockTenantRepo(): jest.Mocked<TenantRepository> {
  return {
    findByCode: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(makeTenant()),
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    save: jest.fn().mockImplementation(async (t: TenantModel) => {
      if (!t.id) t.setPersistence('new-id', new Date(), new Date());
      return t;
    }),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

describe('TenantCommandHandler', () => {
  let handler: TenantCommandHandler;
  let tenantRepo: jest.Mocked<TenantRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    tenantRepo = createMockTenantRepo();
    handler = new TenantCommandHandler(tenantRepo);
  });

  describe('createTenant', () => {
    it('code 중복이 없으면 save를 호출하고 id를 반환한다', async () => {
      tenantRepo.findByCode.mockResolvedValue(null);

      const result = await handler.createTenant({ code: 'new', name: 'New Corp' });

      expect(tenantRepo.findByCode).toHaveBeenCalledWith('new');
      expect(tenantRepo.save).toHaveBeenCalledTimes(1);
      expect(result.id).toBeDefined();
    });

    it('code가 이미 존재하면 ConflictException을 던진다', async () => {
      tenantRepo.findByCode.mockResolvedValue(makeTenant());

      await expect(
        handler.createTenant({ code: 'acme', name: 'Dup' }),
      ).rejects.toThrow(ConflictException);

      expect(tenantRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('updateTenant', () => {
    it('findById → changeName → save 순서로 호출된다', async () => {
      await handler.updateTenant('tenant-1', { name: 'New Name' });

      expect(tenantRepo.findById).toHaveBeenCalledWith('tenant-1');
      expect(tenantRepo.save).toHaveBeenCalledTimes(1);

      expect(tenantRepo.findById.mock.invocationCallOrder[0]).toBeLessThan(
        tenantRepo.save.mock.invocationCallOrder[0],
      );
    });

    it('테넌트가 없으면 NotFoundException을 던진다', async () => {
      tenantRepo.findById.mockResolvedValue(null);

      await expect(
        handler.updateTenant('no-such', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);

      expect(tenantRepo.save).not.toHaveBeenCalled();
    });

    it('name이 없으면 changeName을 호출하지 않는다 (save는 호출)', async () => {
      await handler.updateTenant('tenant-1', {});

      expect(tenantRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteTenant', () => {
    it('findById → delete 순서로 호출된다', async () => {
      await handler.deleteTenant('tenant-1');

      expect(tenantRepo.findById).toHaveBeenCalledWith('tenant-1');
      expect(tenantRepo.delete).toHaveBeenCalledWith('tenant-1');

      expect(tenantRepo.findById.mock.invocationCallOrder[0]).toBeLessThan(
        tenantRepo.delete.mock.invocationCallOrder[0],
      );
    });

    it('테넌트가 없으면 NotFoundException을 던진다', async () => {
      tenantRepo.findById.mockResolvedValue(null);

      await expect(handler.deleteTenant('no-such')).rejects.toThrow(
        NotFoundException,
      );

      expect(tenantRepo.delete).not.toHaveBeenCalled();
    });
  });
});
