import { AdminGroupController } from '@presentation/controllers/admin/group.controller';
import { AdminRoleController } from '@presentation/controllers/admin/role.controller';
import { AdminUserController } from '@presentation/controllers/admin/user.controller';
import {
  makePaginatedResult,
  makePaginationQuery,
  makeTenantContext,
} from '../support/controller-test-helpers';

describe('관리자 관계형 컨트롤러', () => {
  const tenant = makeTenantContext();
  const query = makePaginationQuery({ page: 3, limit: 5 });

  describe('AdminGroupController', () => {
    let controller: AdminGroupController;
    let commandPort: any;
    let queryPort: any;

    beforeEach(() => {
      commandPort = {
        createGroup: jest.fn(),
        updateGroup: jest.fn(),
        deleteGroup: jest.fn(),
        assignRole: jest.fn(),
        removeRole: jest.fn(),
      };
      queryPort = {
        getGroups: jest.fn(),
        getGroup: jest.fn(),
        getGroupRoles: jest.fn(),
      };
      controller = new AdminGroupController(commandPort, queryPort);
    });

    it('list는 tenant.id와 query를 queryPort에 전달한다', async () => {
      const result = makePaginatedResult([{ id: 'group-1' } as any], 1);
      queryPort.getGroups.mockResolvedValue(result);

      await expect(controller.list(tenant, query)).resolves.toBe(result);
      expect(queryPort.getGroups).toHaveBeenCalledWith(tenant.id, query);
    });

    it('get은 tenant.id와 id를 queryPort에 전달한다', async () => {
      const result = { id: 'group-1' } as any;
      queryPort.getGroup.mockResolvedValue(result);

      await expect(controller.get(tenant, 'group-1')).resolves.toBe(result);
      expect(queryPort.getGroup).toHaveBeenCalledWith(tenant.id, 'group-1');
    });

    it('create는 tenant.id와 dto를 commandPort에 전달한다', async () => {
      const dto = { code: 'dev', name: 'Developers' } as any;
      const result = { id: 'group-1' };
      commandPort.createGroup.mockResolvedValue(result);

      await expect(controller.create(tenant, dto)).resolves.toBe(result);
      expect(commandPort.createGroup).toHaveBeenCalledWith(tenant.id, dto);
    });

    it('update는 tenant.id와 id, dto를 commandPort에 전달한다', async () => {
      const dto = { name: 'Platform Team' } as any;
      commandPort.updateGroup.mockResolvedValue(undefined);

      await expect(
        controller.update(tenant, 'group-1', dto),
      ).resolves.toBeUndefined();
      expect(commandPort.updateGroup).toHaveBeenCalledWith(
        tenant.id,
        'group-1',
        dto,
      );
    });

    it('delete는 tenant.id와 id를 commandPort에 전달한다', async () => {
      commandPort.deleteGroup.mockResolvedValue(undefined);

      await expect(controller.delete(tenant, 'group-1')).resolves.toBeUndefined();
      expect(commandPort.deleteGroup).toHaveBeenCalledWith(
        tenant.id,
        'group-1',
      );
    });

    it('getRoles는 tenant.id와 id를 queryPort에 전달한다', async () => {
      const result = [{ id: 'role-1', code: 'admin' }] as any;
      queryPort.getGroupRoles.mockResolvedValue(result);

      await expect(controller.getRoles(tenant, 'group-1')).resolves.toBe(result);
      expect(queryPort.getGroupRoles).toHaveBeenCalledWith(
        tenant.id,
        'group-1',
      );
    });

    it('assignRole은 tenant.id와 groupId, roleId를 commandPort에 전달한다', async () => {
      commandPort.assignRole.mockResolvedValue(undefined);

      await expect(
        controller.assignRole(tenant, 'group-1', 'role-1'),
      ).resolves.toBeUndefined();
      expect(commandPort.assignRole).toHaveBeenCalledWith(
        tenant.id,
        'group-1',
        'role-1',
      );
    });

    it('removeRole은 tenant.id와 groupId, roleId를 commandPort에 전달한다', async () => {
      commandPort.removeRole.mockResolvedValue(undefined);

      await expect(
        controller.removeRole(tenant, 'group-1', 'role-1'),
      ).resolves.toBeUndefined();
      expect(commandPort.removeRole).toHaveBeenCalledWith(
        tenant.id,
        'group-1',
        'role-1',
      );
    });
  });

  describe('AdminRoleController', () => {
    let controller: AdminRoleController;
    let commandPort: any;
    let queryPort: any;

    beforeEach(() => {
      commandPort = {
        createRole: jest.fn(),
        updateRole: jest.fn(),
        deleteRole: jest.fn(),
        addPermissionToRole: jest.fn(),
        removePermissionFromRole: jest.fn(),
      };
      queryPort = {
        getRoles: jest.fn(),
        getRole: jest.fn(),
        getRolePermissions: jest.fn(),
      };
      controller = new AdminRoleController(commandPort, queryPort);
    });

    it('list는 tenant.id와 query를 queryPort에 전달한다', async () => {
      const result = makePaginatedResult([{ id: 'role-1' } as any], 1);
      queryPort.getRoles.mockResolvedValue(result);

      await expect(controller.list(tenant, query)).resolves.toBe(result);
      expect(queryPort.getRoles).toHaveBeenCalledWith(tenant.id, query);
    });

    it('get은 tenant.id와 id를 queryPort에 전달한다', async () => {
      const result = { id: 'role-1' } as any;
      queryPort.getRole.mockResolvedValue(result);

      await expect(controller.get(tenant, 'role-1')).resolves.toBe(result);
      expect(queryPort.getRole).toHaveBeenCalledWith(tenant.id, 'role-1');
    });

    it('create는 tenant.id와 dto를 commandPort에 전달한다', async () => {
      const dto = { code: 'admin', name: 'Admin' } as any;
      const result = { id: 'role-1' };
      commandPort.createRole.mockResolvedValue(result);

      await expect(controller.create(tenant, dto)).resolves.toBe(result);
      expect(commandPort.createRole).toHaveBeenCalledWith(tenant.id, dto);
    });

    it('update는 tenant.id와 id, dto를 commandPort에 전달한다', async () => {
      const dto = { name: 'Super Admin' } as any;
      commandPort.updateRole.mockResolvedValue(undefined);

      await expect(
        controller.update(tenant, 'role-1', dto),
      ).resolves.toBeUndefined();
      expect(commandPort.updateRole).toHaveBeenCalledWith(
        tenant.id,
        'role-1',
        dto,
      );
    });

    it('delete는 tenant.id와 id를 commandPort에 전달한다', async () => {
      commandPort.deleteRole.mockResolvedValue(undefined);

      await expect(controller.delete(tenant, 'role-1')).resolves.toBeUndefined();
      expect(commandPort.deleteRole).toHaveBeenCalledWith(
        tenant.id,
        'role-1',
      );
    });

    it('listPermissions는 tenant.id와 roleId, query를 queryPort에 전달한다', async () => {
      const result = makePaginatedResult([{ id: 'perm-1' } as any], 1);
      queryPort.getRolePermissions.mockResolvedValue(result);

      await expect(
        controller.listPermissions(tenant, 'role-1', query),
      ).resolves.toBe(result);
      expect(queryPort.getRolePermissions).toHaveBeenCalledWith(
        tenant.id,
        'role-1',
        query,
      );
    });

    it('addPermission은 tenant.id와 roleId, permissionId를 commandPort에 전달한다', async () => {
      commandPort.addPermissionToRole.mockResolvedValue(undefined);

      await expect(
        controller.addPermission(tenant, 'role-1', 'perm-1'),
      ).resolves.toBeUndefined();
      expect(commandPort.addPermissionToRole).toHaveBeenCalledWith(
        tenant.id,
        'role-1',
        'perm-1',
      );
    });

    it('removePermission은 tenant.id와 roleId, permissionId를 commandPort에 전달한다', async () => {
      commandPort.removePermissionFromRole.mockResolvedValue(undefined);

      await expect(
        controller.removePermission(tenant, 'role-1', 'perm-1'),
      ).resolves.toBeUndefined();
      expect(commandPort.removePermissionFromRole).toHaveBeenCalledWith(
        tenant.id,
        'role-1',
        'perm-1',
      );
    });
  });

  describe('AdminUserController', () => {
    let controller: AdminUserController;
    let commandPort: any;
    let queryPort: any;

    beforeEach(() => {
      commandPort = {
        createUser: jest.fn(),
        updateUser: jest.fn(),
        deleteUser: jest.fn(),
        assignRole: jest.fn(),
        removeRole: jest.fn(),
      };
      queryPort = {
        getUsers: jest.fn(),
        getUser: jest.fn(),
        getUserRoles: jest.fn(),
      };
      controller = new AdminUserController(commandPort, queryPort);
    });

    it('list는 tenant.id와 query를 queryPort에 전달한다', async () => {
      const result = makePaginatedResult([{ id: 'user-1' } as any], 1);
      queryPort.getUsers.mockResolvedValue(result);

      await expect(controller.list(tenant, query)).resolves.toBe(result);
      expect(queryPort.getUsers).toHaveBeenCalledWith(tenant.id, query);
    });

    it('get은 tenant.id와 id를 queryPort에 전달한다', async () => {
      const result = { id: 'user-1' } as any;
      queryPort.getUser.mockResolvedValue(result);

      await expect(controller.get(tenant, 'user-1')).resolves.toBe(result);
      expect(queryPort.getUser).toHaveBeenCalledWith(tenant.id, 'user-1');
    });

    it('create는 tenant.id와 dto를 commandPort에 전달한다', async () => {
      const dto = { username: 'john', password: 'secret123' } as any;
      const result = { id: 'user-1' };
      commandPort.createUser.mockResolvedValue(result);

      await expect(controller.create(tenant, dto)).resolves.toBe(result);
      expect(commandPort.createUser).toHaveBeenCalledWith(tenant.id, dto);
    });

    it('update는 tenant.id와 id, dto를 commandPort에 전달한다', async () => {
      const dto = { email: 'john@example.com' } as any;
      commandPort.updateUser.mockResolvedValue(undefined);

      await expect(
        controller.update(tenant, 'user-1', dto),
      ).resolves.toBeUndefined();
      expect(commandPort.updateUser).toHaveBeenCalledWith(
        tenant.id,
        'user-1',
        dto,
      );
    });

    it('delete는 tenant.id와 id를 commandPort에 전달한다', async () => {
      commandPort.deleteUser.mockResolvedValue(undefined);

      await expect(controller.delete(tenant, 'user-1')).resolves.toBeUndefined();
      expect(commandPort.deleteUser).toHaveBeenCalledWith(
        tenant.id,
        'user-1',
      );
    });

    it('getRoles는 tenant.id와 id를 queryPort에 전달한다', async () => {
      const result = [{ id: 'role-1' }] as any;
      queryPort.getUserRoles.mockResolvedValue(result);

      await expect(controller.getRoles(tenant, 'user-1')).resolves.toBe(result);
      expect(queryPort.getUserRoles).toHaveBeenCalledWith(
        tenant.id,
        'user-1',
      );
    });

    it('assignRole은 tenant.id와 userId, roleId를 commandPort에 전달한다', async () => {
      commandPort.assignRole.mockResolvedValue(undefined);

      await expect(
        controller.assignRole(tenant, 'user-1', 'role-1'),
      ).resolves.toBeUndefined();
      expect(commandPort.assignRole).toHaveBeenCalledWith(
        tenant.id,
        'user-1',
        'role-1',
      );
    });

    it('removeRole은 tenant.id와 userId, roleId를 commandPort에 전달한다', async () => {
      commandPort.removeRole.mockResolvedValue(undefined);

      await expect(
        controller.removeRole(tenant, 'user-1', 'role-1'),
      ).resolves.toBeUndefined();
      expect(commandPort.removeRole).toHaveBeenCalledWith(
        tenant.id,
        'user-1',
        'role-1',
      );
    });
  });
});
