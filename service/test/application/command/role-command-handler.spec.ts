import { ConflictException, NotFoundException } from '@nestjs/common';
import { RoleCommandHandler } from '@application/commands/handlers/role-command.handler';
import type { RoleRepository, PermissionRepository, RolePermissionRepository } from '@domain/repositories';
import { RoleModel } from '@domain/models/role';

function makeRole(id = 'role-1', tenantId = 'tenant-1'): RoleModel {
  const r = new RoleModel({ tenantId, code: 'admin', name: 'Admin', description: null });
  r.setPersistence(id, new Date(), new Date());
  return r;
}

function createMockRoleRepo(): jest.Mocked<RoleRepository> {
  return {
    findById: jest.fn().mockResolvedValue(makeRole()),
    findByCode: jest.fn().mockResolvedValue(null),
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    save: jest.fn().mockImplementation(async (r: RoleModel) => {
      if (!r.id) r.setPersistence('new-id', new Date(), new Date());
      return r;
    }),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockPermissionRepo(): jest.Mocked<PermissionRepository> {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findByCode: jest.fn().mockResolvedValue(null),
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

function createMockRolePermissionRepo(): jest.Mocked<RolePermissionRepository> {
  return {
    add: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(false),
    listByRole: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  };
}

describe('RoleCommandHandler', () => {
  let handler: RoleCommandHandler;
  let roleRepo: jest.Mocked<RoleRepository>;
  let permissionRepo: jest.Mocked<PermissionRepository>;
  let rolePermissionRepo: jest.Mocked<RolePermissionRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    roleRepo = createMockRoleRepo();
    permissionRepo = createMockPermissionRepo();
    rolePermissionRepo = createMockRolePermissionRepo();
    handler = new RoleCommandHandler(roleRepo, permissionRepo, rolePermissionRepo);
  });

  describe('createRole', () => {
    it('code 중복이 없으면 save를 호출하고 id를 반환한다', async () => {
      const result = await handler.createRole('tenant-1', {
        code: 'editor',
        name: 'Editor',
      });

      expect(roleRepo.findByCode).toHaveBeenCalledWith('tenant-1', 'editor');
      expect(roleRepo.save).toHaveBeenCalledTimes(1);
      expect(result.id).toBeDefined();
    });

    it('code가 이미 존재하면 ConflictException을 던진다', async () => {
      roleRepo.findByCode.mockResolvedValue(makeRole());

      await expect(
        handler.createRole('tenant-1', { code: 'admin', name: 'Dup' }),
      ).rejects.toThrow(ConflictException);

      expect(roleRepo.save).not.toHaveBeenCalled();
    });

    it('description을 포함한 역할을 생성할 수 있다', async () => {
      await handler.createRole('tenant-1', {
        code: 'viewer',
        name: 'Viewer',
        description: 'Read-only access',
      });

      const savedRole = roleRepo.save.mock.calls[0][0] as RoleModel;
      expect(savedRole.description).toBe('Read-only access');
    });
  });

  describe('updateRole', () => {
    it('findById → save 순서로 호출된다', async () => {
      await handler.updateRole('tenant-1', 'role-1', { name: 'Super Admin' });

      expect(roleRepo.findById).toHaveBeenCalledWith('role-1');
      expect(roleRepo.save).toHaveBeenCalledTimes(1);
      expect(roleRepo.findById.mock.invocationCallOrder[0]).toBeLessThan(
        roleRepo.save.mock.invocationCallOrder[0],
      );
    });

    it('역할이 없으면 NotFoundException을 던진다', async () => {
      roleRepo.findById.mockResolvedValue(null);

      await expect(
        handler.updateRole('tenant-1', 'no-such', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);

      expect(roleRepo.save).not.toHaveBeenCalled();
    });

    it('tenantId 불일치 시 NotFoundException을 던진다', async () => {
      roleRepo.findById.mockResolvedValue(makeRole('role-1', 'other-tenant'));

      await expect(
        handler.updateRole('tenant-1', 'role-1', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('description 없이 호출해도 save는 실행된다', async () => {
      await handler.updateRole('tenant-1', 'role-1', {});

      expect(roleRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteRole', () => {
    it('findById → delete 순서로 호출된다', async () => {
      await handler.deleteRole('tenant-1', 'role-1');

      expect(roleRepo.findById).toHaveBeenCalledWith('role-1');
      expect(roleRepo.delete).toHaveBeenCalledWith('role-1');
      expect(roleRepo.findById.mock.invocationCallOrder[0]).toBeLessThan(
        roleRepo.delete.mock.invocationCallOrder[0],
      );
    });

    it('역할이 없으면 NotFoundException을 던진다', async () => {
      roleRepo.findById.mockResolvedValue(null);

      await expect(handler.deleteRole('tenant-1', 'no-such')).rejects.toThrow(
        NotFoundException,
      );

      expect(roleRepo.delete).not.toHaveBeenCalled();
    });

    it('tenantId 불일치 시 NotFoundException을 던진다', async () => {
      roleRepo.findById.mockResolvedValue(makeRole('role-1', 'other-tenant'));

      await expect(handler.deleteRole('tenant-1', 'role-1')).rejects.toThrow(
        NotFoundException,
      );

      expect(roleRepo.delete).not.toHaveBeenCalled();
    });
  });
});
