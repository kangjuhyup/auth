import { ConflictException, NotFoundException } from '@nestjs/common';
import { GroupCommandHandler } from '@application/commands/handlers/group-command.handler';
import type { GroupRepository, RoleRepository, RoleAssignmentRepository } from '@domain/repositories';
import { GroupModel } from '@domain/models/group';
import { RoleModel } from '@domain/models/role';

function makeGroup(id = 'group-1', tenantId = 'tenant-1'): GroupModel {
  const g = new GroupModel({ tenantId, code: 'dev', name: 'Dev Team' });
  g.setPersistence(id, new Date(), new Date());
  return g;
}

function makeRole(id = 'role-1', tenantId = 'tenant-1'): RoleModel {
  const r = new RoleModel({ tenantId, code: 'admin', name: 'Admin' });
  r.setPersistence(id, new Date(), new Date());
  return r;
}

function createMockGroupRepo(): jest.Mocked<GroupRepository> {
  return {
    findById: jest.fn().mockResolvedValue(makeGroup()),
    findByCode: jest.fn().mockResolvedValue(null),
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    save: jest.fn().mockImplementation(async (g: GroupModel) => {
      if (!g.id) g.setPersistence('new-id', new Date(), new Date());
      return g;
    }),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockRoleRepo(): jest.Mocked<RoleRepository> {
  return {
    findById: jest.fn().mockResolvedValue(makeRole()),
    findByCode: jest.fn().mockResolvedValue(null),
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

function createMockRoleAssignment(): jest.Mocked<RoleAssignmentRepository> {
  return {
    assignToUser: jest.fn().mockResolvedValue(undefined),
    removeFromUser: jest.fn().mockResolvedValue(undefined),
    assignToGroup: jest.fn().mockResolvedValue(undefined),
    removeFromGroup: jest.fn().mockResolvedValue(undefined),
    listForUser: jest.fn().mockResolvedValue([]),
    listForGroup: jest.fn().mockResolvedValue([]),
  };
}

describe('GroupCommandHandler', () => {
  let handler: GroupCommandHandler;
  let groupRepo: jest.Mocked<GroupRepository>;
  let roleRepo: jest.Mocked<RoleRepository>;
  let roleAssignment: jest.Mocked<RoleAssignmentRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    groupRepo = createMockGroupRepo();
    roleRepo = createMockRoleRepo();
    roleAssignment = createMockRoleAssignment();
    handler = new GroupCommandHandler(groupRepo, roleRepo, roleAssignment);
  });

  describe('createGroup', () => {
    it('code 중복이 없으면 save를 호출하고 id를 반환한다', async () => {
      groupRepo.findByCode.mockResolvedValue(null);

      const result = await handler.createGroup('tenant-1', {
        code: 'new',
        name: 'New Team',
      });

      expect(groupRepo.findByCode).toHaveBeenCalledWith('tenant-1', 'new');
      expect(groupRepo.save).toHaveBeenCalledTimes(1);
      expect(result.id).toBeDefined();
    });

    it('code가 이미 존재하면 ConflictException을 던진다', async () => {
      groupRepo.findByCode.mockResolvedValue(makeGroup());

      await expect(
        handler.createGroup('tenant-1', { code: 'dev', name: 'Dup' }),
      ).rejects.toThrow(ConflictException);

      expect(groupRepo.save).not.toHaveBeenCalled();
    });

    it('parentId를 포함한 그룹을 생성할 수 있다', async () => {
      const result = await handler.createGroup('tenant-1', {
        code: 'sub',
        name: 'Sub Team',
        parentId: 'group-parent',
      });

      expect(result.id).toBeDefined();
      const savedGroup = groupRepo.save.mock.calls[0][0] as GroupModel;
      expect(savedGroup.parentId).toBe('group-parent');
    });
  });

  describe('updateGroup', () => {
    it('findById → save 순서로 호출된다', async () => {
      await handler.updateGroup('tenant-1', 'group-1', { name: 'Updated' });

      expect(groupRepo.findById).toHaveBeenCalledWith('group-1');
      expect(groupRepo.save).toHaveBeenCalledTimes(1);
      expect(groupRepo.findById.mock.invocationCallOrder[0]).toBeLessThan(
        groupRepo.save.mock.invocationCallOrder[0],
      );
    });

    it('그룹이 없으면 NotFoundException을 던진다', async () => {
      groupRepo.findById.mockResolvedValue(null);

      await expect(
        handler.updateGroup('tenant-1', 'no-such', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);

      expect(groupRepo.save).not.toHaveBeenCalled();
    });

    it('tenantId 불일치 시 NotFoundException을 던진다', async () => {
      groupRepo.findById.mockResolvedValue(makeGroup('group-1', 'other-tenant'));

      await expect(
        handler.updateGroup('tenant-1', 'group-1', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteGroup', () => {
    it('findById → delete 순서로 호출된다', async () => {
      await handler.deleteGroup('tenant-1', 'group-1');

      expect(groupRepo.findById).toHaveBeenCalledWith('group-1');
      expect(groupRepo.delete).toHaveBeenCalledWith('group-1');
      expect(groupRepo.findById.mock.invocationCallOrder[0]).toBeLessThan(
        groupRepo.delete.mock.invocationCallOrder[0],
      );
    });

    it('그룹이 없으면 NotFoundException을 던진다', async () => {
      groupRepo.findById.mockResolvedValue(null);

      await expect(
        handler.deleteGroup('tenant-1', 'no-such'),
      ).rejects.toThrow(NotFoundException);

      expect(groupRepo.delete).not.toHaveBeenCalled();
    });

    it('tenantId 불일치 시 NotFoundException을 던진다', async () => {
      groupRepo.findById.mockResolvedValue(makeGroup('group-1', 'other-tenant'));

      await expect(
        handler.deleteGroup('tenant-1', 'group-1'),
      ).rejects.toThrow(NotFoundException);

      expect(groupRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('assignRole', () => {
    it('그룹과 롤이 모두 존재하면 assignToGroup을 호출한다', async () => {
      await handler.assignRole('tenant-1', 'group-1', 'role-1');

      expect(groupRepo.findById).toHaveBeenCalledWith('group-1');
      expect(roleRepo.findById).toHaveBeenCalledWith('role-1');
      expect(roleAssignment.assignToGroup).toHaveBeenCalledWith({
        groupId: 'group-1',
        roleId: 'role-1',
      });
    });

    it('그룹이 없으면 NotFoundException을 던진다', async () => {
      groupRepo.findById.mockResolvedValue(null);

      await expect(
        handler.assignRole('tenant-1', 'no-group', 'role-1'),
      ).rejects.toThrow(NotFoundException);

      expect(roleAssignment.assignToGroup).not.toHaveBeenCalled();
    });

    it('롤이 없으면 NotFoundException을 던진다', async () => {
      roleRepo.findById.mockResolvedValue(null);

      await expect(
        handler.assignRole('tenant-1', 'group-1', 'no-role'),
      ).rejects.toThrow(NotFoundException);

      expect(roleAssignment.assignToGroup).not.toHaveBeenCalled();
    });

    it('그룹 tenantId 불일치 시 NotFoundException을 던진다', async () => {
      groupRepo.findById.mockResolvedValue(makeGroup('group-1', 'other-tenant'));

      await expect(
        handler.assignRole('tenant-1', 'group-1', 'role-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('롤 tenantId 불일치 시 NotFoundException을 던진다', async () => {
      roleRepo.findById.mockResolvedValue(makeRole('role-1', 'other-tenant'));

      await expect(
        handler.assignRole('tenant-1', 'group-1', 'role-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeRole', () => {
    it('그룹이 존재하면 removeFromGroup을 호출한다', async () => {
      await handler.removeRole('tenant-1', 'group-1', 'role-1');

      expect(groupRepo.findById).toHaveBeenCalledWith('group-1');
      expect(roleAssignment.removeFromGroup).toHaveBeenCalledWith({
        groupId: 'group-1',
        roleId: 'role-1',
      });
    });

    it('그룹이 없으면 NotFoundException을 던진다', async () => {
      groupRepo.findById.mockResolvedValue(null);

      await expect(
        handler.removeRole('tenant-1', 'no-group', 'role-1'),
      ).rejects.toThrow(NotFoundException);

      expect(roleAssignment.removeFromGroup).not.toHaveBeenCalled();
    });

    it('그룹 tenantId 불일치 시 NotFoundException을 던진다', async () => {
      groupRepo.findById.mockResolvedValue(makeGroup('group-1', 'other-tenant'));

      await expect(
        handler.removeRole('tenant-1', 'group-1', 'role-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
