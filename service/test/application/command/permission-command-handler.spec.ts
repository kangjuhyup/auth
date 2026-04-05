import { ConflictException, NotFoundException } from '@nestjs/common';
import { PermissionCommandHandler } from '@application/commands/handlers/permission-command.handler';
import type { PermissionRepository } from '@domain/repositories';
import { PermissionModel } from '@domain/models/permission';

function makePermission(id = 'perm-1', tenantId = 'tenant-1'): PermissionModel {
  const p = new PermissionModel({
    tenantId,
    code: 'articles:read',
    resource: 'articles',
    action: 'read',
    description: null,
  });
  p.setPersistence(id, new Date(), new Date());
  return p;
}

function createMockPermissionRepo(): jest.Mocked<PermissionRepository> {
  return {
    findById: jest.fn().mockResolvedValue(makePermission()),
    findByCode: jest.fn().mockResolvedValue(null),
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    save: jest.fn().mockImplementation(async (p: PermissionModel) => {
      if (!p.id) p.setPersistence('new-id', new Date(), new Date());
      return p;
    }),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

describe('PermissionCommandHandler', () => {
  let handler: PermissionCommandHandler;
  let permissionRepo: jest.Mocked<PermissionRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    permissionRepo = createMockPermissionRepo();
    handler = new PermissionCommandHandler(permissionRepo);
  });

  describe('createPermission', () => {
    it('code 중복이 없으면 save를 호출하고 id를 반환한다', async () => {
      permissionRepo.findByCode.mockResolvedValue(null);

      const result = await handler.createPermission('tenant-1', {
        code: 'articles:write',
        resource: 'articles',
        action: 'write',
      });

      expect(permissionRepo.findByCode).toHaveBeenCalledWith('tenant-1', 'articles:write');
      expect(permissionRepo.save).toHaveBeenCalledTimes(1);
      expect(result.id).toBeDefined();
    });

    it('code가 이미 존재하면 ConflictException을 던진다', async () => {
      permissionRepo.findByCode.mockResolvedValue(makePermission());

      await expect(
        handler.createPermission('tenant-1', { code: 'articles:read' }),
      ).rejects.toThrow(ConflictException);

      expect(permissionRepo.save).not.toHaveBeenCalled();
    });

    it('resource/action/description이 없으면 null 기본값으로 저장한다', async () => {
      await handler.createPermission('tenant-1', {
        code: 'articles:manage',
      });

      const saved = permissionRepo.save.mock.calls[0][0] as PermissionModel;
      expect(saved.resource).toBeNull();
      expect(saved.action).toBeNull();
      expect(saved.description).toBeNull();
    });
  });

  describe('updatePermission', () => {
    it('findById → 필드 수정 → save 순서로 호출된다', async () => {
      await handler.updatePermission('tenant-1', 'perm-1', {
        resource: 'posts',
        action: 'write',
        description: 'new desc',
      });

      expect(permissionRepo.findById).toHaveBeenCalledWith('perm-1');
      expect(permissionRepo.save).toHaveBeenCalledTimes(1);
      expect(permissionRepo.findById.mock.invocationCallOrder[0]).toBeLessThan(
        permissionRepo.save.mock.invocationCallOrder[0],
      );
    });

    it('퍼미션이 없으면 NotFoundException을 던진다', async () => {
      permissionRepo.findById.mockResolvedValue(null);

      await expect(
        handler.updatePermission('tenant-1', 'no-such', { resource: 'x' }),
      ).rejects.toThrow(NotFoundException);

      expect(permissionRepo.save).not.toHaveBeenCalled();
    });

    it('다른 테넌트의 퍼미션이면 NotFoundException을 던진다', async () => {
      permissionRepo.findById.mockResolvedValue(makePermission('perm-1', 'other-tenant'));

      await expect(
        handler.updatePermission('tenant-1', 'perm-1', { resource: 'x' }),
      ).rejects.toThrow(NotFoundException);

      expect(permissionRepo.save).not.toHaveBeenCalled();
    });

    it('null을 전달하면 resource/action/description을 비운다', async () => {
      const permission = makePermission();
      permissionRepo.findById.mockResolvedValue(permission);

      await handler.updatePermission('tenant-1', 'perm-1', {
        resource: null,
        action: null,
        description: null,
      } as any);

      expect(permission.resource).toBeNull();
      expect(permission.action).toBeNull();
      expect(permission.description).toBeNull();
      expect(permissionRepo.save).toHaveBeenCalledWith(permission);
    });
  });

  describe('deletePermission', () => {
    it('findById → delete 순서로 호출된다', async () => {
      await handler.deletePermission('tenant-1', 'perm-1');

      expect(permissionRepo.findById).toHaveBeenCalledWith('perm-1');
      expect(permissionRepo.delete).toHaveBeenCalledWith('perm-1');
      expect(permissionRepo.findById.mock.invocationCallOrder[0]).toBeLessThan(
        permissionRepo.delete.mock.invocationCallOrder[0],
      );
    });

    it('퍼미션이 없으면 NotFoundException을 던진다', async () => {
      permissionRepo.findById.mockResolvedValue(null);

      await expect(
        handler.deletePermission('tenant-1', 'no-such'),
      ).rejects.toThrow(NotFoundException);

      expect(permissionRepo.delete).not.toHaveBeenCalled();
    });

    it('다른 테넌트의 퍼미션이면 NotFoundException을 던진다', async () => {
      permissionRepo.findById.mockResolvedValue(makePermission('perm-1', 'other-tenant'));

      await expect(
        handler.deletePermission('tenant-1', 'perm-1'),
      ).rejects.toThrow(NotFoundException);

      expect(permissionRepo.delete).not.toHaveBeenCalled();
    });
  });
});
