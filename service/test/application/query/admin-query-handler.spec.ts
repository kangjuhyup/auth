import { NotFoundException } from '@nestjs/common';
import { AdminQueryHandler } from '@application/queries/handlers/admin-query.handler';
import type { TenantRepository, GroupRepository, RoleRepository, PermissionRepository } from '@domain/repositories';
import { TenantModel } from '@domain/models/tenant';
import { GroupModel } from '@domain/models/group';
import { RoleModel } from '@domain/models/role';

function makeTenant(id: string, code: string, name: string): TenantModel {
  const t = new TenantModel({ code, name });
  t.setPersistence(id, new Date('2024-01-01'), new Date('2024-01-01'));
  return t;
}

function makeGroup(id: string, tenantId: string): GroupModel {
  const g = new GroupModel({ tenantId, code: 'dev', name: 'Dev' });
  g.setPersistence(id, new Date('2024-01-01'), new Date('2024-01-01'));
  return g;
}

function createMockTenantRepo(): jest.Mocked<TenantRepository> {
  return {
    findByCode: jest.fn(),
    findById: jest.fn(),
    list: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

function createMockGroupRepo(): jest.Mocked<GroupRepository> {
  return {
    findById: jest.fn(),
    findByCode: jest.fn(),
    list: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

function makeRole(id: string, tenantId: string): RoleModel {
  const r = new RoleModel({ tenantId, code: 'admin', name: 'Admin', description: null });
  r.setPersistence(id, new Date('2024-01-01'), new Date('2024-01-01'));
  return r;
}

function createMockRoleRepo(): jest.Mocked<RoleRepository> {
  return {
    findById: jest.fn(),
    findByCode: jest.fn(),
    list: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

function createMockPermissionRepo(): jest.Mocked<PermissionRepository> {
  return {
    findById: jest.fn(),
    findByCode: jest.fn(),
    list: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

describe('AdminQueryHandler - Tenant', () => {
  let handler: AdminQueryHandler;
  let tenantRepo: jest.Mocked<TenantRepository>;
  let groupRepo: jest.Mocked<GroupRepository>;
  let roleRepo: jest.Mocked<RoleRepository>;
  let permissionRepo: jest.Mocked<PermissionRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    tenantRepo = createMockTenantRepo();
    groupRepo = createMockGroupRepo();
    roleRepo = createMockRoleRepo();
    permissionRepo = createMockPermissionRepo();
    handler = new AdminQueryHandler(tenantRepo, groupRepo, roleRepo, permissionRepo);
  });

  describe('getTenants', () => {
    it('페이지네이션된 테넌트 목록을 반환한다', async () => {
      const tenants = [
        makeTenant('1', 'acme', 'ACME'),
        makeTenant('2', 'beta', 'Beta'),
      ];
      tenantRepo.list.mockResolvedValue({ items: tenants, total: 2 });

      const result = await handler.getTenants({ page: 1, limit: 10 });

      expect(tenantRepo.list).toHaveBeenCalledWith({ page: 1, limit: 10 });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('page/limit 미지정 시 기본값(1/20)을 사용한다', async () => {
      tenantRepo.list.mockResolvedValue({ items: [], total: 0 });

      await handler.getTenants({});

      expect(tenantRepo.list).toHaveBeenCalledWith({ page: 1, limit: 20 });
    });

    it('반환 항목에 필수 필드가 모두 포함된다', async () => {
      tenantRepo.list.mockResolvedValue({
        items: [makeTenant('1', 'acme', 'ACME')],
        total: 1,
      });

      const result = await handler.getTenants({ page: 1, limit: 10 });
      const item = result.items[0];

      expect(item.id).toBe('1');
      expect(item.code).toBe('acme');
      expect(item.name).toBe('ACME');
      expect(item.createdAt).toBeDefined();
      expect(item.updatedAt).toBeDefined();
    });
  });

  describe('getTenant', () => {
    it('id로 테넌트를 조회하여 반환한다', async () => {
      tenantRepo.findById.mockResolvedValue(makeTenant('1', 'acme', 'ACME'));

      const result = await handler.getTenant('1');

      expect(tenantRepo.findById).toHaveBeenCalledWith('1');
      expect(result.id).toBe('1');
      expect(result.code).toBe('acme');
      expect(result.name).toBe('ACME');
    });

    it('존재하지 않는 id면 NotFoundException을 던진다', async () => {
      tenantRepo.findById.mockResolvedValue(null);

      await expect(handler.getTenant('no-such')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

describe('AdminQueryHandler - Group', () => {
  let handler: AdminQueryHandler;
  let tenantRepo: jest.Mocked<TenantRepository>;
  let groupRepo: jest.Mocked<GroupRepository>;
  let roleRepo: jest.Mocked<RoleRepository>;
  let permissionRepo: jest.Mocked<PermissionRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    tenantRepo = createMockTenantRepo();
    groupRepo = createMockGroupRepo();
    roleRepo = createMockRoleRepo();
    permissionRepo = createMockPermissionRepo();
    handler = new AdminQueryHandler(tenantRepo, groupRepo, roleRepo, permissionRepo);
  });

  describe('getGroups', () => {
    it('tenantId로 페이지네이션된 그룹 목록을 반환한다', async () => {
      groupRepo.list.mockResolvedValue({
        items: [makeGroup('g-1', 'tenant-1'), makeGroup('g-2', 'tenant-1')],
        total: 2,
      });

      const result = await handler.getGroups('tenant-1', { page: 1, limit: 10 });

      expect(groupRepo.list).toHaveBeenCalledWith({ tenantId: 'tenant-1', page: 1, limit: 10 });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('page/limit 미지정 시 기본값(1/20)을 사용한다', async () => {
      groupRepo.list.mockResolvedValue({ items: [], total: 0 });

      await handler.getGroups('tenant-1', {});

      expect(groupRepo.list).toHaveBeenCalledWith({ tenantId: 'tenant-1', page: 1, limit: 20 });
    });
  });

  describe('getGroup', () => {
    it('tenantId + id로 그룹을 조회하여 반환한다', async () => {
      groupRepo.findById.mockResolvedValue(makeGroup('g-1', 'tenant-1'));

      const result = await handler.getGroup('tenant-1', 'g-1');

      expect(groupRepo.findById).toHaveBeenCalledWith('g-1');
      expect(result.id).toBe('g-1');
    });

    it('그룹이 없으면 NotFoundException을 던진다', async () => {
      groupRepo.findById.mockResolvedValue(null);

      await expect(handler.getGroup('tenant-1', 'no-such')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('tenantId 불일치 시 NotFoundException을 던진다', async () => {
      groupRepo.findById.mockResolvedValue(makeGroup('g-1', 'other-tenant'));

      await expect(handler.getGroup('tenant-1', 'g-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

describe('AdminQueryHandler - Role', () => {
  let handler: AdminQueryHandler;
  let tenantRepo: jest.Mocked<TenantRepository>;
  let groupRepo: jest.Mocked<GroupRepository>;
  let roleRepo: jest.Mocked<RoleRepository>;
  let permissionRepo: jest.Mocked<PermissionRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    tenantRepo = createMockTenantRepo();
    groupRepo = createMockGroupRepo();
    roleRepo = createMockRoleRepo();
    permissionRepo = createMockPermissionRepo();
    handler = new AdminQueryHandler(tenantRepo, groupRepo, roleRepo, permissionRepo);
  });

  describe('getRoles', () => {
    it('tenantId로 페이지네이션된 역할 목록을 반환한다', async () => {
      roleRepo.list.mockResolvedValue({
        items: [makeRole('r-1', 'tenant-1'), makeRole('r-2', 'tenant-1')],
        total: 2,
      });

      const result = await handler.getRoles('tenant-1', { page: 1, limit: 10 });

      expect(roleRepo.list).toHaveBeenCalledWith({ tenantId: 'tenant-1', page: 1, limit: 10 });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('page/limit 미지정 시 기본값(1/20)을 사용한다', async () => {
      roleRepo.list.mockResolvedValue({ items: [], total: 0 });

      await handler.getRoles('tenant-1', {});

      expect(roleRepo.list).toHaveBeenCalledWith({ tenantId: 'tenant-1', page: 1, limit: 20 });
    });

    it('반환 항목에 description이 포함된다', async () => {
      roleRepo.list.mockResolvedValue({ items: [makeRole('r-1', 'tenant-1')], total: 1 });

      const result = await handler.getRoles('tenant-1', { page: 1, limit: 10 });

      expect(result.items[0].description).toBeNull();
    });
  });

  describe('getRole', () => {
    it('tenantId + id로 역할을 조회하여 반환한다', async () => {
      roleRepo.findById.mockResolvedValue(makeRole('r-1', 'tenant-1'));

      const result = await handler.getRole('tenant-1', 'r-1');

      expect(roleRepo.findById).toHaveBeenCalledWith('r-1');
      expect(result.id).toBe('r-1');
      expect(result.code).toBe('admin');
      expect(result.name).toBe('Admin');
    });

    it('역할이 없으면 NotFoundException을 던진다', async () => {
      roleRepo.findById.mockResolvedValue(null);

      await expect(handler.getRole('tenant-1', 'no-such')).rejects.toThrow(NotFoundException);
    });

    it('tenantId 불일치 시 NotFoundException을 던진다', async () => {
      roleRepo.findById.mockResolvedValue(makeRole('r-1', 'other-tenant'));

      await expect(handler.getRole('tenant-1', 'r-1')).rejects.toThrow(NotFoundException);
    });
  });
});
