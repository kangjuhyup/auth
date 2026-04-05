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
    findCredentialsByType: jest.fn().mockResolvedValue([]),
    saveCredential: jest.fn().mockResolvedValue(undefined),
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
    existsForUser: jest.fn().mockResolvedValue(false),
    existsForGroup: jest.fn().mockResolvedValue(false),
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

    it('이미 할당된 role이면 assignToUser를 다시 호출하지 않는다', async () => {
      roleAssignment.existsForUser.mockResolvedValue(true);

      await handler.assignRole('tenant-1', 'user-1', 'role-1');

      expect(roleAssignment.assignToUser).not.toHaveBeenCalled();
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

  describe('createUser', () => {
    it('username 중복 시 UsernameAlreadyExists를 던진다', async () => {
      userWriteRepo.findByUsername.mockResolvedValue(makeUser());

      await expect(
        handler.createUser('tenant-1', { username: 'testuser', password: 'pw' } as any),
      ).rejects.toThrow('UsernameAlreadyExists');

      expect(userWriteRepo.save).not.toHaveBeenCalled();
    });

    it('성공 시 hash → save 순서로 호출하고 { id }를 반환한다', async () => {
      userWriteRepo.findByUsername.mockResolvedValue(undefined);

      const result = await handler.createUser('tenant-1', {
        username: 'newuser',
        password: 'secure123',
      } as any);

      expect(passwordHash.hash).toHaveBeenCalledWith('secure123');
      expect(userWriteRepo.save).toHaveBeenCalledTimes(1);
      expect(result.id).toBeTruthy();
    });

    it('ACTIVE가 아닌 status를 주면 생성 직후 상태를 변경한다', async () => {
      userWriteRepo.findByUsername.mockResolvedValue(undefined);

      await handler.createUser('tenant-1', {
        username: 'locked-user',
        password: 'secure123',
        status: 'LOCKED',
      } as any);

      const savedUser = userWriteRepo.save.mock.calls[0][0] as UserModel;
      expect(savedUser.status).toBe('LOCKED');
    });
  });

  describe('updateUser', () => {
    it('유저가 없으면 NotFoundException을 던진다', async () => {
      userWriteRepo.findById.mockResolvedValue(undefined);

      await expect(
        handler.updateUser('tenant-1', 'user-1', {} as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('다른 tenant의 유저이면 NotFoundException을 던진다', async () => {
      userWriteRepo.findById.mockResolvedValue(makeUser('user-1', 'other-tenant'));

      await expect(
        handler.updateUser('tenant-1', 'user-1', {} as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('성공 시 email/phone/status를 변경하고 save를 호출한다', async () => {
      const user = makeUser();
      userWriteRepo.findById.mockResolvedValue(user);

      await handler.updateUser('tenant-1', 'user-1', {
        email: 'updated@ex.com',
        status: 'LOCKED',
      } as any);

      expect(user.email).toBe('updated@ex.com');
      expect(user.status).toBe('LOCKED');
      expect(userWriteRepo.save).toHaveBeenCalledWith(user);
    });

    it('email/phone에 null을 주면 연락처를 제거한다', async () => {
      const user = makeUser();
      user.changeEmail('before@example.com');
      user.changePhone('010-9999-9999');
      userWriteRepo.findById.mockResolvedValue(user);

      await handler.updateUser('tenant-1', 'user-1', {
        email: null,
        phone: null,
      } as any);

      expect(user.email).toBeNull();
      expect(user.phone).toBeNull();
      expect(userWriteRepo.save).toHaveBeenCalledWith(user);
    });
  });

  describe('deleteUser', () => {
    it('유저가 없으면 NotFoundException을 던진다', async () => {
      userWriteRepo.findById.mockResolvedValue(undefined);

      await expect(
        handler.deleteUser('tenant-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('다른 tenant의 유저이면 NotFoundException을 던진다', async () => {
      userWriteRepo.findById.mockResolvedValue(makeUser('user-1', 'other-tenant'));

      await expect(
        handler.deleteUser('tenant-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('성공 시 withdraw() 상태로 변경하고 save를 호출한다', async () => {
      const user = makeUser();
      userWriteRepo.findById.mockResolvedValue(user);

      await handler.deleteUser('tenant-1', 'user-1');

      expect(user.status).toBe('WITHDRAWN');
      expect(userWriteRepo.save).toHaveBeenCalledWith(user);
    });
  });
});
