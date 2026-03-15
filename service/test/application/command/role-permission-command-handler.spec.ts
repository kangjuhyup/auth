import { ConflictException, NotFoundException } from '@nestjs/common';
import { RoleCommandHandler } from '@application/commands/handlers/role-command.handler';
import type { RoleRepository, PermissionRepository, RolePermissionRepository } from '@domain/repositories';
import { RoleModel } from '@domain/models/role';
import { PermissionModel } from '@domain/models/permission';

function makeRole(id = 'role-1', tenantId = 'tenant-1'): RoleModel {
  const r = new RoleModel({ tenantId, code: 'editor', name: 'Editor', description: null });
  r.setPersistence(id, new Date(), new Date());
  return r;
}

function makePermission(id = 'perm-1', tenantId = 'tenant-1'): PermissionModel {
  const p = new PermissionModel({ tenantId, code: 'articles:read', resource: 'articles', action: 'read', description: null });
  p.setPersistence(id, new Date(), new Date());
  return p;
}

function createMockRoleRepo(): jest.Mocked<RoleRepository> {
  return {
    findById: jest.fn().mockResolvedValue(makeRole()),
    findByCode: jest.fn().mockResolvedValue(null),
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    save: jest.fn().mockImplementation(async (r: RoleModel) => r),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockPermissionRepo(): jest.Mocked<PermissionRepository> {
  return {
    findById: jest.fn().mockResolvedValue(makePermission()),
    findByCode: jest.fn().mockResolvedValue(null),
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    save: jest.fn().mockImplementation(async (p: PermissionModel) => p),
    delete: jest.fn().mockResolvedValue(undefined),
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

describe('RoleCommandHandler - permission 관리', () => {
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

  describe('addPermissionToRole', () => {
    it('role과 permission이 모두 같은 테넌트이면 add를 호출한다', async () => {
      await handler.addPermissionToRole('tenant-1', 'role-1', 'perm-1');

      expect(roleRepo.findById).toHaveBeenCalledWith('role-1');
      expect(permissionRepo.findById).toHaveBeenCalledWith('perm-1');
      expect(rolePermissionRepo.exists).toHaveBeenCalledWith({ roleId: 'role-1', permissionId: 'perm-1' });
      expect(rolePermissionRepo.add).toHaveBeenCalledWith({ roleId: 'role-1', permissionId: 'perm-1' });
    });

    it('role이 없으면 NotFoundException을 던진다', async () => {
      roleRepo.findById.mockResolvedValue(null);

      await expect(
        handler.addPermissionToRole('tenant-1', 'no-role', 'perm-1'),
      ).rejects.toThrow(NotFoundException);

      expect(rolePermissionRepo.add).not.toHaveBeenCalled();
    });

    it('role이 다른 테넌트이면 NotFoundException을 던진다', async () => {
      roleRepo.findById.mockResolvedValue(makeRole('role-1', 'other-tenant'));

      await expect(
        handler.addPermissionToRole('tenant-1', 'role-1', 'perm-1'),
      ).rejects.toThrow(NotFoundException);

      expect(rolePermissionRepo.add).not.toHaveBeenCalled();
    });

    it('permission이 없으면 NotFoundException을 던진다', async () => {
      permissionRepo.findById.mockResolvedValue(null);

      await expect(
        handler.addPermissionToRole('tenant-1', 'role-1', 'no-perm'),
      ).rejects.toThrow(NotFoundException);

      expect(rolePermissionRepo.add).not.toHaveBeenCalled();
    });

    it('이미 할당된 permission이면 ConflictException을 던진다', async () => {
      rolePermissionRepo.exists.mockResolvedValue(true);

      await expect(
        handler.addPermissionToRole('tenant-1', 'role-1', 'perm-1'),
      ).rejects.toThrow(ConflictException);

      expect(rolePermissionRepo.add).not.toHaveBeenCalled();
    });
  });

  describe('removePermissionFromRole', () => {
    beforeEach(() => {
      rolePermissionRepo.exists.mockResolvedValue(true);
    });

    it('할당된 permission이면 remove를 호출한다', async () => {
      await handler.removePermissionFromRole('tenant-1', 'role-1', 'perm-1');

      expect(roleRepo.findById).toHaveBeenCalledWith('role-1');
      expect(rolePermissionRepo.exists).toHaveBeenCalledWith({ roleId: 'role-1', permissionId: 'perm-1' });
      expect(rolePermissionRepo.remove).toHaveBeenCalledWith({ roleId: 'role-1', permissionId: 'perm-1' });
    });

    it('role이 없으면 NotFoundException을 던진다', async () => {
      roleRepo.findById.mockResolvedValue(null);

      await expect(
        handler.removePermissionFromRole('tenant-1', 'no-role', 'perm-1'),
      ).rejects.toThrow(NotFoundException);

      expect(rolePermissionRepo.remove).not.toHaveBeenCalled();
    });

    it('role이 다른 테넌트이면 NotFoundException을 던진다', async () => {
      roleRepo.findById.mockResolvedValue(makeRole('role-1', 'other-tenant'));

      await expect(
        handler.removePermissionFromRole('tenant-1', 'role-1', 'perm-1'),
      ).rejects.toThrow(NotFoundException);

      expect(rolePermissionRepo.remove).not.toHaveBeenCalled();
    });

    it('할당되지 않은 permission이면 NotFoundException을 던진다', async () => {
      rolePermissionRepo.exists.mockResolvedValue(false);

      await expect(
        handler.removePermissionFromRole('tenant-1', 'role-1', 'perm-1'),
      ).rejects.toThrow(NotFoundException);

      expect(rolePermissionRepo.remove).not.toHaveBeenCalled();
    });
  });
});
