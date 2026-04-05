import './support/mock-mikro-orm-core';

import { RoleAssignmentRepositoryImpl } from '@infrastructure/repositories/role-assignment.repository.impl';
import { RolePermissionRepositoryImpl } from '@infrastructure/repositories/role-permission.repository.impl';
import { RoleInheritRepositoryImpl } from '@infrastructure/repositories/role-inherit.repository.impl';
import { UserRoleOrmEntity } from '@infrastructure/mikro-orm/entities/user-role';
import { GroupRoleOrmEntity } from '@infrastructure/mikro-orm/entities/group-role';
import { RolePermissionOrmEntity } from '@infrastructure/mikro-orm/entities/role-permission';
import { RoleInheritOrmEntity } from '@infrastructure/mikro-orm/entities/role-inherit';
import { UserOrmEntity } from '@infrastructure/mikro-orm/entities/user';
import { GroupOrmEntity } from '@infrastructure/mikro-orm/entities/group';
import { RoleOrmEntity } from '@infrastructure/mikro-orm/entities/role';
import { PermissionOrmEntity } from '@infrastructure/mikro-orm/entities/permission';
import {
  EntityManagerMock,
  asLoadedRef,
  createEntityManagerMock,
  createGroupRoleEntity,
  createPermissionEntity,
  createRoleEntity,
  createRoleInheritEntity,
  createRolePermissionEntity,
  createUserRoleEntity,
} from './support/repository-test-helpers';

describe('Membership Repository Implementations', () => {
  let em: EntityManagerMock;

  beforeEach(() => {
    em = createEntityManagerMock();
  });

  describe('RoleAssignmentRepositoryImpl', () => {
    it('유저에 역할을 할당한다', async () => {
      const repository = new RoleAssignmentRepositoryImpl(em as any);

      await repository.assignToUser({ userId: 'user-1', roleId: 'role-1' });

      expect(em.getReference).toHaveBeenCalledWith(UserOrmEntity, 'user-1');
      expect(em.getReference).toHaveBeenCalledWith(RoleOrmEntity, 'role-1');
      expect(em.persist).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({ id: 'user-1' }),
          role: expect.objectContaining({ id: 'role-1' }),
        }),
      );
    });

    it('유저 역할 할당을 해제한다', async () => {
      const repository = new RoleAssignmentRepositoryImpl(em as any);
      const entity = createUserRoleEntity();
      em.findOneOrFail.mockResolvedValue(entity);

      await repository.removeFromUser({ userId: 'user-1', roleId: 'role-1' });

      expect(em.findOneOrFail).toHaveBeenCalledWith(UserRoleOrmEntity, {
        user: { id: 'user-1' },
        role: { id: 'role-1' },
      });
      expect(em.remove).toHaveBeenCalledWith(entity);
    });

    it('그룹에 역할을 할당하고 해제한다', async () => {
      const repository = new RoleAssignmentRepositoryImpl(em as any);
      const entity = createGroupRoleEntity();
      em.findOneOrFail.mockResolvedValue(entity);

      await repository.assignToGroup({ groupId: 'group-1', roleId: 'role-1' });
      await repository.removeFromGroup({ groupId: 'group-1', roleId: 'role-1' });

      expect(em.getReference).toHaveBeenCalledWith(GroupOrmEntity, 'group-1');
      expect(em.getReference).toHaveBeenCalledWith(RoleOrmEntity, 'role-1');
      expect(em.findOneOrFail).toHaveBeenCalledWith(GroupRoleOrmEntity, {
        group: { id: 'group-1' },
        role: { id: 'role-1' },
      });
      expect(em.remove).toHaveBeenCalledWith(entity);
    });

    it('유저/그룹 할당 존재 여부를 반환한다', async () => {
      const repository = new RoleAssignmentRepositoryImpl(em as any);
      em.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

      await expect(
        repository.existsForUser({ userId: 'user-1', roleId: 'role-1' }),
      ).resolves.toBe(true);
      await expect(
        repository.existsForGroup({ groupId: 'group-1', roleId: 'role-1' }),
      ).resolves.toBe(false);
    });

    it('유저와 그룹에 할당된 역할 목록을 반환한다', async () => {
      const repository = new RoleAssignmentRepositoryImpl(em as any);
      const role = asLoadedRef(createRoleEntity());
      const viewer = asLoadedRef(
        createRoleEntity({ id: 'role-2', code: 'viewer', name: 'Viewer' }),
      );
      em.find
        .mockResolvedValueOnce([createUserRoleEntity({ role })])
        .mockResolvedValueOnce([createGroupRoleEntity({ role: viewer })]);

      const userRoles = await repository.listForUser('user-1');
      const groupRoles = await repository.listForGroup('group-1');

      expect(userRoles.map((item) => item.code)).toEqual(['admin']);
      expect(groupRoles.map((item) => item.code)).toEqual(['viewer']);
      expect(em.find).toHaveBeenNthCalledWith(
        1,
        UserRoleOrmEntity,
        { user: { id: 'user-1' } },
        { populate: ['role', 'role.tenant'] },
      );
      expect(em.find).toHaveBeenNthCalledWith(
        2,
        GroupRoleOrmEntity,
        { group: { id: 'group-1' } },
        { populate: ['role', 'role.tenant'] },
      );
    });
  });

  describe('RolePermissionRepositoryImpl', () => {
    it('역할에 권한을 연결한다', async () => {
      const repository = new RolePermissionRepositoryImpl(em as any);

      await repository.add({ roleId: 'role-1', permissionId: 'permission-1' });

      expect(em.getReference).toHaveBeenCalledWith(RoleOrmEntity, 'role-1');
      expect(em.getReference).toHaveBeenCalledWith(
        PermissionOrmEntity,
        'permission-1',
      );
      expect(em.persist).toHaveBeenCalledWith(
        expect.objectContaining({
          role: expect.objectContaining({ id: 'role-1' }),
          permission: expect.objectContaining({ id: 'permission-1' }),
        }),
      );
    });

    it('역할 권한 연결을 해제한다', async () => {
      const repository = new RolePermissionRepositoryImpl(em as any);
      const entity = createRolePermissionEntity();
      em.findOneOrFail.mockResolvedValue(entity);

      await repository.remove({ roleId: 'role-1', permissionId: 'permission-1' });

      expect(em.findOneOrFail).toHaveBeenCalledWith(RolePermissionOrmEntity, {
        role: { id: 'role-1' },
        permission: { id: 'permission-1' },
      });
      expect(em.remove).toHaveBeenCalledWith(entity);
    });

    it('역할 권한 연결 존재 여부를 반환한다', async () => {
      const repository = new RolePermissionRepositoryImpl(em as any);
      em.count.mockResolvedValue(1);

      await expect(
        repository.exists({ roleId: 'role-1', permissionId: 'permission-1' }),
      ).resolves.toBe(true);
    });

    it('역할에 연결된 권한 목록과 total을 반환한다', async () => {
      const repository = new RolePermissionRepositoryImpl(em as any);
      em.findAndCount.mockResolvedValue([
        [
          createRolePermissionEntity(),
          createRolePermissionEntity({
            permission: asLoadedRef(
              createPermissionEntity({
                id: 'permission-2',
                code: 'tenant.write',
                action: 'write',
              }),
            ),
          }),
        ],
        2,
      ]);

      const result = await repository.listByRole({
        roleId: 'role-1',
        page: 1,
        limit: 10,
      });

      expect(result.total).toBe(2);
      expect(result.items.map((item) => item.code)).toEqual([
        'tenant.read',
        'tenant.write',
      ]);
      expect(em.findAndCount).toHaveBeenCalledWith(
        RolePermissionOrmEntity,
        { role: { id: 'role-1' } },
        {
          populate: ['permission', 'permission.tenant'],
          limit: 10,
          offset: 0,
        },
      );
    });
  });

  describe('RoleInheritRepositoryImpl', () => {
    it('역할 상속 관계를 추가한다', async () => {
      const repository = new RoleInheritRepositoryImpl(em as any);

      await repository.addInheritance({
        parentRoleId: 'role-parent',
        childRoleId: 'role-child',
      });

      expect(em.getReference).toHaveBeenCalledWith(RoleOrmEntity, 'role-parent');
      expect(em.getReference).toHaveBeenCalledWith(RoleOrmEntity, 'role-child');
      expect(em.persist).toHaveBeenCalledWith(
        expect.objectContaining({
          parent: expect.objectContaining({ id: 'role-parent' }),
          child: expect.objectContaining({ id: 'role-child' }),
        }),
      );
    });

    it('상속 관계가 있으면 삭제한다', async () => {
      const repository = new RoleInheritRepositoryImpl(em as any);
      const entity = createRoleInheritEntity();
      em.findOne.mockResolvedValue(entity);

      await repository.removeInheritance({
        parentRoleId: 'role-parent',
        childRoleId: 'role-child',
      });

      expect(em.findOne).toHaveBeenCalledWith(
        RoleInheritOrmEntity,
        { parent: 'role-parent', child: 'role-child' },
      );
      expect(em.remove).toHaveBeenCalledWith(entity);
    });

    it('부모/자식 역할 ID 목록을 조회한다', async () => {
      const repository = new RoleInheritRepositoryImpl(em as any);
      em.find
        .mockResolvedValueOnce([
          createRoleInheritEntity({
            child: asLoadedRef(createRoleEntity({ id: 'role-child-1' })),
          }),
          createRoleInheritEntity({
            child: asLoadedRef(createRoleEntity({ id: 'role-child-2' })),
          }),
        ])
        .mockResolvedValueOnce([
          createRoleInheritEntity({
            parent: asLoadedRef(createRoleEntity({ id: 'role-parent-1' })),
          }),
        ]);

      await expect(repository.getChildRoleIds('role-parent')).resolves.toEqual([
        'role-child-1',
        'role-child-2',
      ]);
      await expect(repository.getParentRoleIds('role-child')).resolves.toEqual([
        'role-parent-1',
      ]);
    });

    it('중복 없이 모든 하위 역할을 해석한다', async () => {
      const repository = new RoleInheritRepositoryImpl(em as any);
      em.find.mockImplementation(async (_entity, where) => {
        if ((where as any).parent === 'role-root') {
          return [
            createRoleInheritEntity({
              parent: asLoadedRef(createRoleEntity({ id: 'role-root' })),
              child: asLoadedRef(createRoleEntity({ id: 'role-a' })),
            }),
            createRoleInheritEntity({
              parent: asLoadedRef(createRoleEntity({ id: 'role-root' })),
              child: asLoadedRef(createRoleEntity({ id: 'role-b' })),
            }),
          ];
        }

        if ((where as any).parent === 'role-a') {
          return [
            createRoleInheritEntity({
              parent: asLoadedRef(createRoleEntity({ id: 'role-a' })),
              child: asLoadedRef(createRoleEntity({ id: 'role-c' })),
            }),
          ];
        }

        if ((where as any).parent === 'role-b') {
          return [
            createRoleInheritEntity({
              parent: asLoadedRef(createRoleEntity({ id: 'role-b' })),
              child: asLoadedRef(createRoleEntity({ id: 'role-c' })),
            }),
          ];
        }

        return [];
      });

      await expect(repository.resolveAllRoleIds('role-root')).resolves.toEqual([
        'role-root',
        'role-b',
        'role-c',
        'role-a',
      ]);
    });
  });
});
