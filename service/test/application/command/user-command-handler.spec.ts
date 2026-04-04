import { NotFoundException } from '@nestjs/common';
import { UserCommandHandler } from '@application/commands/handlers/user-command.handler';
import type { UserWriteRepositoryPort } from '@application/commands/ports/user-write-repository.port';
import type { RoleRepository, RoleAssignmentRepository } from '@domain/repositories';
import type { PasswordHashPort, HashResult, HashPolicy } from '@application/ports/password-hash.port';
import { UserModel } from '@domain/models/user';
import { RoleModel } from '@domain/models/role';

function makeUser(id = 'user-1', tenantId = 'tenant-1'): UserModel {
  const user = UserModel.create({
    id,
    tenantId,
    username: 'testuser',
    passwordCredential: {
      id: 'cred-1',
      type: 'password',
      secretHash: 'hash',
      enabled: true,
    } as any,
  });
  return user;
}

function makeRole(id = 'role-1', tenantId = 'tenant-1'): RoleModel {
  const r = new RoleModel({ tenantId, code: 'admin', name: 'Admin' });
  r.setPersistence(id, new Date(), new Date());
  return r;
}

function createMockUserWriteRepo(): jest.Mocked<UserWriteRepositoryPort> {
  return {
    findById: jest.fn().mockResolvedValue(makeUser()),
    findByUsername: jest.fn().mockResolvedValue(null),
    findByContact: jest.fn().mockResolvedValue(null),
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    save: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockPasswordHash(): jest.Mocked<PasswordHashPort> {
  const result: HashResult = { alg: 'argon2id', params: {}, version: 1, hash: 'hashed' };
  return {
    defaultPolicy: jest.fn().mockReturnValue({ alg: 'argon2id', params: {}, version: 1 } as HashPolicy),
    hash: jest.fn().mockResolvedValue(result),
    verify: jest.fn().mockResolvedValue(true),
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

describe('UserCommandHandler', () => {
  let handler: UserCommandHandler;
  let userWriteRepo: jest.Mocked<UserWriteRepositoryPort>;
  let roleRepo: jest.Mocked<RoleRepository>;
  let roleAssignment: jest.Mocked<RoleAssignmentRepository>;
  let passwordHash: jest.Mocked<PasswordHashPort>;

  beforeEach(() => {
    jest.clearAllMocks();
    userWriteRepo = createMockUserWriteRepo();
    roleRepo = createMockRoleRepo();
    roleAssignment = createMockRoleAssignment();
    passwordHash = createMockPasswordHash();
    handler = new UserCommandHandler(userWriteRepo, roleRepo, roleAssignment, passwordHash);
  });

  describe('assignRole', () => {
    it('유저와 롤이 모두 존재하면 assignToUser를 호출한다', async () => {
      await handler.assignRole('tenant-1', 'user-1', 'role-1');

      expect(userWriteRepo.findById).toHaveBeenCalledWith('user-1');
      expect(roleRepo.findById).toHaveBeenCalledWith('role-1');
      expect(roleAssignment.assignToUser).toHaveBeenCalledWith({
        userId: 'user-1',
        roleId: 'role-1',
      });
    });

    it('유저가 없으면 NotFoundException을 던진다', async () => {
      userWriteRepo.findById.mockResolvedValue(undefined);

      await expect(
        handler.assignRole('tenant-1', 'no-user', 'role-1'),
      ).rejects.toThrow(NotFoundException);

      expect(roleAssignment.assignToUser).not.toHaveBeenCalled();
    });

    it('롤이 없으면 NotFoundException을 던진다', async () => {
      roleRepo.findById.mockResolvedValue(null);

      await expect(
        handler.assignRole('tenant-1', 'user-1', 'no-role'),
      ).rejects.toThrow(NotFoundException);

      expect(roleAssignment.assignToUser).not.toHaveBeenCalled();
    });

    it('유저 tenantId 불일치 시 NotFoundException을 던진다', async () => {
      userWriteRepo.findById.mockResolvedValue(makeUser('user-1', 'other-tenant'));

      await expect(
        handler.assignRole('tenant-1', 'user-1', 'role-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('롤 tenantId 불일치 시 NotFoundException을 던진다', async () => {
      roleRepo.findById.mockResolvedValue(makeRole('role-1', 'other-tenant'));

      await expect(
        handler.assignRole('tenant-1', 'user-1', 'role-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeRole', () => {
    it('유저가 존재하면 removeFromUser를 호출한다', async () => {
      await handler.removeRole('tenant-1', 'user-1', 'role-1');

      expect(userWriteRepo.findById).toHaveBeenCalledWith('user-1');
      expect(roleAssignment.removeFromUser).toHaveBeenCalledWith({
        userId: 'user-1',
        roleId: 'role-1',
      });
    });

    it('유저가 없으면 NotFoundException을 던진다', async () => {
      userWriteRepo.findById.mockResolvedValue(undefined);

      await expect(
        handler.removeRole('tenant-1', 'no-user', 'role-1'),
      ).rejects.toThrow(NotFoundException);

      expect(roleAssignment.removeFromUser).not.toHaveBeenCalled();
    });

    it('유저 tenantId 불일치 시 NotFoundException을 던진다', async () => {
      userWriteRepo.findById.mockResolvedValue(makeUser('user-1', 'other-tenant'));

      await expect(
        handler.removeRole('tenant-1', 'user-1', 'role-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
