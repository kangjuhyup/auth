import './support/mock-mikro-orm-core';

import { TenantRepositoryImpl } from '@infrastructure/repositories/tenant.repository.impl';
import { ClientRepositoryImpl } from '@infrastructure/repositories/client.repository.impl';
import { GroupRepositoryImpl } from '@infrastructure/repositories/group.repository.impl';
import { RoleRepositoryImpl } from '@infrastructure/repositories/role.repository.impl';
import { PermissionRepositoryImpl } from '@infrastructure/repositories/permission.repository.impl';
import { TenantOrmEntity } from '@infrastructure/mikro-orm/entities/tenant';
import { ClientOrmEntity } from '@infrastructure/mikro-orm/entities/client';
import { GroupOrmEntity } from '@infrastructure/mikro-orm/entities/group';
import { RoleOrmEntity } from '@infrastructure/mikro-orm/entities/role';
import { PermissionOrmEntity } from '@infrastructure/mikro-orm/entities/permission';
import {
  EntityManagerMock,
  asLoadedRef,
  createClientEntity,
  createClientModel,
  createEntityManagerMock,
  createGroupEntity,
  createGroupModel,
  createPermissionEntity,
  createPermissionModel,
  createRoleEntity,
  createRoleModel,
  createTenantEntity,
  createTenantModel,
} from './support/repository-test-helpers';

describe('CRUD Repository Implementations', () => {
  let em: EntityManagerMock;

  beforeEach(() => {
    em = createEntityManagerMock();
  });

  describe('TenantRepositoryImpl', () => {
    it('code로 테넌트를 조회한다', async () => {
      const repository = new TenantRepositoryImpl(em as any);
      const entity = createTenantEntity();
      em.findOne.mockResolvedValue(entity);

      await expect(repository.findByCode('acme')).resolves.toMatchObject({
        id: 'tenant-1',
        code: 'acme',
        name: 'Acme',
      });
      expect(em.findOne).toHaveBeenCalledWith(TenantOrmEntity, { code: 'acme' });
    });

    it('페이지네이션 목록과 total을 반환한다', async () => {
      const repository = new TenantRepositoryImpl(em as any);
      em.findAndCount.mockResolvedValue([
        [
          createTenantEntity(),
          createTenantEntity({ id: 'tenant-2', code: 'beta', name: 'Beta' }),
        ],
        3,
      ]);

      const result = await repository.list({ page: 2, limit: 2 });

      expect(result.total).toBe(3);
      expect(result.items.map((item) => item.code)).toEqual(['acme', 'beta']);
      expect(em.findAndCount).toHaveBeenCalledWith(
        TenantOrmEntity,
        {},
        { limit: 2, offset: 2 },
      );
    });

    it('신규 테넌트를 저장한다', async () => {
      const repository = new TenantRepositoryImpl(em as any);
      em.persist.mockImplementation((entity: any) => {
        entity.id = 'tenant-2';
        return { flush: em.flush };
      });

      const saved = await repository.save(
        createTenantModel({ code: 'beta', name: 'Beta' }),
      );

      expect(saved.id).toBe('tenant-2');
      expect(saved.code).toBe('beta');
      expect(em.persist).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'beta',
          name: 'Beta',
        }),
      );
    });

    it('기존 테넌트를 수정한다', async () => {
      const repository = new TenantRepositoryImpl(em as any);
      const existing = createTenantEntity();
      em.findOneOrFail.mockResolvedValue(existing);

      const saved = await repository.save(
        createTenantModel({ code: 'acme', name: 'Acme Updated' }, 'tenant-1'),
      );

      expect(saved.name).toBe('Acme Updated');
      expect(existing.name).toBe('Acme Updated');
      expect(em.flush).toHaveBeenCalled();
    });

    it('테넌트를 삭제한다', async () => {
      const repository = new TenantRepositoryImpl(em as any);
      const existing = createTenantEntity();
      em.findOneOrFail.mockResolvedValue(existing);

      await repository.delete('tenant-1');

      expect(em.findOneOrFail).toHaveBeenCalledWith(TenantOrmEntity, {
        id: 'tenant-1',
      });
      expect(em.remove).toHaveBeenCalledWith(existing);
    });
  });

  describe('ClientRepositoryImpl', () => {
    it('clientId와 tenantId로 클라이언트를 조회한다', async () => {
      const repository = new ClientRepositoryImpl(em as any);
      const entity = createClientEntity();
      em.findOne.mockResolvedValue(entity);

      await expect(
        repository.findByClientId('tenant-1', 'client-1'),
      ).resolves.toMatchObject({
        id: 'client-ref-1',
        tenantId: 'tenant-1',
        clientId: 'client-1',
      });
      expect(em.findOne).toHaveBeenCalledWith(
        ClientOrmEntity,
        { tenant: { id: 'tenant-1' }, clientId: 'client-1' },
        { populate: ['tenant'] },
      );
    });

    it('tenant 범위의 클라이언트 목록을 페이지네이션한다', async () => {
      const repository = new ClientRepositoryImpl(em as any);
      em.findAndCount.mockResolvedValue([
        [
          createClientEntity(),
          createClientEntity({
            id: 'client-ref-2',
            clientId: 'client-2',
            name: 'Second Client',
          }),
        ],
        5,
      ]);

      const result = await repository.list({
        tenantId: 'tenant-1',
        page: 2,
        limit: 2,
      });

      expect(result.total).toBe(5);
      expect(result.items.map((item) => item.clientId)).toEqual([
        'client-1',
        'client-2',
      ]);
      expect(em.findAndCount).toHaveBeenCalledWith(
        ClientOrmEntity,
        { tenant: { id: 'tenant-1' } },
        { populate: ['tenant'], limit: 2, offset: 2 },
      );
    });

    it('신규 클라이언트를 저장한다', async () => {
      const repository = new ClientRepositoryImpl(em as any);
      em.persist.mockImplementation((entity: any) => {
        entity.id = 'client-ref-2';
        return { flush: em.flush };
      });

      const saved = await repository.save(
        createClientModel({ clientId: 'client-2', name: 'Second Client' }),
      );

      expect(saved.id).toBe('client-ref-2');
      expect(saved.clientId).toBe('client-2');
      expect(em.getReference).toHaveBeenCalledWith(TenantOrmEntity, 'tenant-1');
      expect(em.persist).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client-2',
          name: 'Second Client',
        }),
      );
    });

    it('기존 클라이언트 설정을 수정한다', async () => {
      const repository = new ClientRepositoryImpl(em as any);
      const existing = createClientEntity();
      em.findOneOrFail.mockResolvedValue(existing);

      const saved = await repository.save(
        createClientModel(
          {
            name: 'Updated Client',
            enabled: false,
            redirectUris: ['https://updated.example.com/callback'],
          },
          'client-ref-1',
        ),
      );

      expect(saved.name).toBe('Updated Client');
      expect(saved.enabled).toBe(false);
      expect(existing.redirectUris).toEqual([
        'https://updated.example.com/callback',
      ]);
      expect(em.flush).toHaveBeenCalled();
    });

    it('클라이언트를 삭제한다', async () => {
      const repository = new ClientRepositoryImpl(em as any);
      const existing = createClientEntity();
      em.findOneOrFail.mockResolvedValue(existing);

      await repository.delete('client-ref-1');

      expect(em.findOneOrFail).toHaveBeenCalledWith(ClientOrmEntity, {
        id: 'client-ref-1',
      });
      expect(em.remove).toHaveBeenCalledWith(existing);
    });
  });

  describe('GroupRepositoryImpl', () => {
    it('tenant와 code로 그룹을 조회한다', async () => {
      const repository = new GroupRepositoryImpl(em as any);
      const parent = asLoadedRef(
        createGroupEntity({ id: 'group-parent', code: 'root', name: 'Root' }),
      );
      const entity = createGroupEntity({ parent: parent as any });
      em.findOne.mockResolvedValue(entity);

      await expect(repository.findByCode('tenant-1', 'ops')).resolves.toMatchObject(
        {
          id: 'group-1',
          tenantId: 'tenant-1',
          code: 'ops',
          parentId: 'group-parent',
        },
      );
      expect(em.findOne).toHaveBeenCalledWith(
        GroupOrmEntity,
        { tenant: { id: 'tenant-1' }, code: 'ops' },
        { populate: ['tenant', 'parent'] },
      );
    });

    it('그룹 목록을 반환한다', async () => {
      const repository = new GroupRepositoryImpl(em as any);
      em.findAndCount.mockResolvedValue([
        [
          createGroupEntity(),
          createGroupEntity({ id: 'group-2', code: 'dev', name: 'Developers' }),
        ],
        4,
      ]);

      const result = await repository.list({
        tenantId: 'tenant-1',
        page: 1,
        limit: 2,
      });

      expect(result.total).toBe(4);
      expect(result.items.map((item) => item.code)).toEqual(['ops', 'dev']);
      expect(em.findAndCount).toHaveBeenCalledWith(
        GroupOrmEntity,
        { tenant: { id: 'tenant-1' } },
        { populate: ['tenant', 'parent'], limit: 2, offset: 0 },
      );
    });

    it('부모 그룹을 포함해 신규 그룹을 저장한다', async () => {
      const repository = new GroupRepositoryImpl(em as any);
      em.persist.mockImplementation((entity: any) => {
        entity.id = 'group-2';
        return { flush: em.flush };
      });

      const saved = await repository.save(
        createGroupModel(
          { code: 'dev', name: 'Developers', parentId: 'group-parent' },
        ),
      );

      expect(saved.id).toBe('group-2');
      expect(saved.parentId).toBe('group-parent');
      expect(em.getReference).toHaveBeenCalledWith(TenantOrmEntity, 'tenant-1');
      expect(em.getReference).toHaveBeenCalledWith(GroupOrmEntity, 'group-parent');
    });

    it('기존 그룹의 부모를 해제하며 수정한다', async () => {
      const repository = new GroupRepositoryImpl(em as any);
      const existing = createGroupEntity({
        parent: asLoadedRef(createGroupEntity({ id: 'group-parent' })) as any,
      });
      em.findOneOrFail.mockResolvedValue(existing);

      const saved = await repository.save(
        createGroupModel(
          { code: 'ops', name: 'Operations Updated', parentId: null },
          'group-1',
        ),
      );

      expect(saved.name).toBe('Operations Updated');
      expect(saved.parentId).toBeNull();
      expect(existing.parent).toBeNull();
      expect(em.flush).toHaveBeenCalled();
    });

    it('그룹을 삭제한다', async () => {
      const repository = new GroupRepositoryImpl(em as any);
      const existing = createGroupEntity();
      em.findOneOrFail.mockResolvedValue(existing);

      await repository.delete('group-1');

      expect(em.findOneOrFail).toHaveBeenCalledWith(GroupOrmEntity, {
        id: 'group-1',
      });
      expect(em.remove).toHaveBeenCalledWith(existing);
    });
  });

  describe('RoleRepositoryImpl', () => {
    it('tenant와 code로 역할을 조회한다', async () => {
      const repository = new RoleRepositoryImpl(em as any);
      const entity = createRoleEntity();
      em.findOne.mockResolvedValue(entity);

      await expect(repository.findByCode('tenant-1', 'admin')).resolves.toMatchObject(
        {
          id: 'role-1',
          tenantId: 'tenant-1',
          code: 'admin',
        },
      );
      expect(em.findOne).toHaveBeenCalledWith(
        RoleOrmEntity,
        { tenant: { id: 'tenant-1' }, code: 'admin' },
        { populate: ['tenant'] },
      );
    });

    it('역할 목록을 페이지네이션한다', async () => {
      const repository = new RoleRepositoryImpl(em as any);
      em.findAndCount.mockResolvedValue([
        [
          createRoleEntity(),
          createRoleEntity({ id: 'role-2', code: 'viewer', name: 'Viewer' }),
        ],
        2,
      ]);

      const result = await repository.list({
        tenantId: 'tenant-1',
        page: 1,
        limit: 10,
      });

      expect(result.total).toBe(2);
      expect(result.items.map((item) => item.code)).toEqual(['admin', 'viewer']);
    });

    it('신규 역할을 저장한다', async () => {
      const repository = new RoleRepositoryImpl(em as any);
      em.persist.mockImplementation((entity: any) => {
        entity.id = 'role-2';
        return { flush: em.flush };
      });

      const saved = await repository.save(
        createRoleModel({ code: 'viewer', name: 'Viewer' }),
      );

      expect(saved.id).toBe('role-2');
      expect(saved.code).toBe('viewer');
      expect(em.getReference).toHaveBeenCalledWith(TenantOrmEntity, 'tenant-1');
    });

    it('기존 역할을 수정한다', async () => {
      const repository = new RoleRepositoryImpl(em as any);
      const existing = createRoleEntity();
      em.findOneOrFail.mockResolvedValue(existing);

      const saved = await repository.save(
        createRoleModel(
          { code: 'admin', name: 'Super Admin', description: null },
          'role-1',
        ),
      );

      expect(saved.name).toBe('Super Admin');
      expect(saved.description).toBeNull();
      expect(existing.description).toBeNull();
      expect(em.flush).toHaveBeenCalled();
    });

    it('역할을 삭제한다', async () => {
      const repository = new RoleRepositoryImpl(em as any);
      const existing = createRoleEntity();
      em.findOneOrFail.mockResolvedValue(existing);

      await repository.delete('role-1');

      expect(em.findOneOrFail).toHaveBeenCalledWith(RoleOrmEntity, { id: 'role-1' });
      expect(em.remove).toHaveBeenCalledWith(existing);
    });
  });

  describe('PermissionRepositoryImpl', () => {
    it('tenant와 code로 권한을 조회한다', async () => {
      const repository = new PermissionRepositoryImpl(em as any);
      const entity = createPermissionEntity();
      em.findOne.mockResolvedValue(entity);

      await expect(
        repository.findByCode('tenant-1', 'tenant.read'),
      ).resolves.toMatchObject({
        id: 'permission-1',
        tenantId: 'tenant-1',
        code: 'tenant.read',
      });
      expect(em.findOne).toHaveBeenCalledWith(
        PermissionOrmEntity,
        { tenant: { id: 'tenant-1' }, code: 'tenant.read' },
        { populate: ['tenant'] },
      );
    });

    it('권한 목록을 페이지네이션한다', async () => {
      const repository = new PermissionRepositoryImpl(em as any);
      em.findAndCount.mockResolvedValue([
        [
          createPermissionEntity(),
          createPermissionEntity({
            id: 'permission-2',
            code: 'tenant.write',
            action: 'write',
          }),
        ],
        2,
      ]);

      const result = await repository.list({
        tenantId: 'tenant-1',
        page: 1,
        limit: 2,
      });

      expect(result.total).toBe(2);
      expect(result.items.map((item) => item.code)).toEqual([
        'tenant.read',
        'tenant.write',
      ]);
      expect(em.findAndCount).toHaveBeenCalledWith(
        PermissionOrmEntity,
        { tenant: { id: 'tenant-1' } },
        { populate: ['tenant'], limit: 2, offset: 0 },
      );
    });

    it('신규 권한을 저장한다', async () => {
      const repository = new PermissionRepositoryImpl(em as any);
      em.persist.mockImplementation((entity: any) => {
        entity.id = 'permission-2';
        return { flush: em.flush };
      });

      const saved = await repository.save(
        createPermissionModel({ code: 'tenant.write', action: 'write' }),
      );

      expect(saved.id).toBe('permission-2');
      expect(saved.code).toBe('tenant.write');
      expect(em.getReference).toHaveBeenCalledWith(TenantOrmEntity, 'tenant-1');
    });

    it('기존 권한을 수정한다', async () => {
      const repository = new PermissionRepositoryImpl(em as any);
      const existing = createPermissionEntity();
      em.findOneOrFail.mockResolvedValue(existing);

      const saved = await repository.save(
        createPermissionModel(
          {
            code: 'tenant.read',
            resource: null,
            action: null,
            description: null,
          },
          'permission-1',
        ),
      );

      expect(saved.resource).toBeNull();
      expect(saved.action).toBeNull();
      expect(existing.description).toBeNull();
    });

    it('권한을 삭제한다', async () => {
      const repository = new PermissionRepositoryImpl(em as any);
      const existing = createPermissionEntity();
      em.findOneOrFail.mockResolvedValue(existing);

      await repository.delete('permission-1');

      expect(em.findOneOrFail).toHaveBeenCalledWith(PermissionOrmEntity, {
        id: 'permission-1',
      });
      expect(em.remove).toHaveBeenCalledWith(existing);
    });
  });
});
