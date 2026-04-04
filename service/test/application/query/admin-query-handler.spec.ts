import { NotFoundException } from '@nestjs/common';
import { AdminQueryHandler } from '@application/queries/handlers/admin-query.handler';
import type {
  TenantRepository,
  GroupRepository,
  RoleRepository,
  PermissionRepository,
  RolePermissionRepository,
  RoleAssignmentRepository,
  ClientRepository,
  TenantConfigRepository,
  JwksKeyRepository,
  ClientAuthPolicyRepository,
  EventRepository,
} from '@domain/repositories';
import type { UserWriteRepositoryPort } from '@application/commands/ports/user-write-repository.port';
import { TenantModel } from '@domain/models/tenant';
import { GroupModel } from '@domain/models/group';
import { RoleModel } from '@domain/models/role';
import { ClientModel } from '@domain/models/client';

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

function makeRole(id: string, tenantId: string): RoleModel {
  const r = new RoleModel({
    tenantId,
    code: 'admin',
    name: 'Admin',
    description: null,
  });
  r.setPersistence(id, new Date('2024-01-01'), new Date('2024-01-01'));
  return r;
}

function makeClient(id: string, tenantId: string): ClientModel {
  const c = new ClientModel({
    tenantId,
    clientId: 'app-web',
    secretEnc: null,
    name: 'Web App',
    type: 'public',
    enabled: true,
    redirectUris: ['https://app.example.com/callback'],
    grantTypes: ['authorization_code'],
    responseTypes: ['code'],
    tokenEndpointAuthMethod: 'none',
    scope: 'openid',
    postLogoutRedirectUris: [],
    applicationType: 'web',
    backchannelLogoutUri: 'https://app.example.com/bc-logout',
    frontchannelLogoutUri: null,
    allowedResources: ['https://api.example.com'],
    skipConsent: false,
  });
  c.setPersistence(id, new Date('2024-01-01'), new Date('2024-01-01'));
  return c;
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

function createMockRolePermissionRepo(): jest.Mocked<RolePermissionRepository> {
  return {
    assign: jest.fn(),
    remove: jest.fn(),
    listByRole: jest.fn(),
  } as any;
}

function createMockRoleAssignmentRepo(): jest.Mocked<RoleAssignmentRepository> {
  return {
    assignToUser: jest.fn(),
    removeFromUser: jest.fn(),
    assignToGroup: jest.fn(),
    removeFromGroup: jest.fn(),
    listForGroup: jest.fn().mockResolvedValue([]),
    listForUser: jest.fn().mockResolvedValue([]),
  } as any;
}

function createMockClientRepo(): jest.Mocked<ClientRepository> {
  return {
    findById: jest.fn(),
    findByClientId: jest.fn(),
    list: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

function createMockTenantConfigRepo(): jest.Mocked<TenantConfigRepository> {
  return {
    findByTenantId: jest.fn().mockResolvedValue(null),
    save: jest.fn(),
  };
}

function createMockJwksKeyRepo(): jest.Mocked<JwksKeyRepository> {
  return {
    findActiveByTenantId: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
    saveMany: jest.fn(),
  };
}

function createMockClientAuthPolicyRepo(): jest.Mocked<ClientAuthPolicyRepository> {
  return {
    findByClientRefId: jest.fn().mockResolvedValue(null),
    save: jest.fn(),
    deleteByClientRefId: jest.fn(),
  };
}

function createMockEventRepo(): jest.Mocked<EventRepository> {
  return {
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    save: jest.fn(),
  };
}

function createMockUserRepo(): jest.Mocked<UserWriteRepositoryPort> {
  return {
    findById: jest.fn().mockResolvedValue(undefined),
    findByUsername: jest.fn().mockResolvedValue(undefined),
    findByContact: jest.fn().mockResolvedValue(undefined),
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    save: jest.fn(),
  };
}

function createHandler() {
  const tenantRepo = createMockTenantRepo();
  const groupRepo = createMockGroupRepo();
  const roleRepo = createMockRoleRepo();
  const permissionRepo = createMockPermissionRepo();
  const rolePermissionRepo = createMockRolePermissionRepo();
  const roleAssignmentRepo = createMockRoleAssignmentRepo();
  const clientRepo = createMockClientRepo();
  const tenantConfigRepo = createMockTenantConfigRepo();
  const jwksKeyRepo = createMockJwksKeyRepo();
  const clientAuthPolicyRepo = createMockClientAuthPolicyRepo();
  const eventRepo = createMockEventRepo();
  const userRepo = createMockUserRepo();

  const handler = new AdminQueryHandler(
    tenantRepo,
    groupRepo,
    roleRepo,
    permissionRepo,
    rolePermissionRepo,
    roleAssignmentRepo,
    clientRepo,
    tenantConfigRepo,
    jwksKeyRepo,
    clientAuthPolicyRepo,
    eventRepo,
    userRepo,
  );

  return {
    handler,
    tenantRepo,
    groupRepo,
    roleRepo,
    permissionRepo,
    rolePermissionRepo,
    roleAssignmentRepo,
    clientRepo,
    tenantConfigRepo,
    jwksKeyRepo,
    clientAuthPolicyRepo,
    eventRepo,
    userRepo,
  };
}

describe('AdminQueryHandler - Tenant', () => {
  let handler: AdminQueryHandler;
  let tenantRepo: jest.Mocked<TenantRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    const deps = createHandler();
    handler = deps.handler;
    tenantRepo = deps.tenantRepo;
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
  let groupRepo: jest.Mocked<GroupRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    const deps = createHandler();
    handler = deps.handler;
    groupRepo = deps.groupRepo;
  });

  describe('getGroups', () => {
    it('tenantId로 페이지네이션된 그룹 목록을 반환한다', async () => {
      groupRepo.list.mockResolvedValue({
        items: [makeGroup('g-1', 'tenant-1'), makeGroup('g-2', 'tenant-1')],
        total: 2,
      });

      const result = await handler.getGroups('tenant-1', {
        page: 1,
        limit: 10,
      });

      expect(groupRepo.list).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        page: 1,
        limit: 10,
      });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('page/limit 미지정 시 기본값(1/20)을 사용한다', async () => {
      groupRepo.list.mockResolvedValue({ items: [], total: 0 });

      await handler.getGroups('tenant-1', {});

      expect(groupRepo.list).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        page: 1,
        limit: 20,
      });
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
  let roleRepo: jest.Mocked<RoleRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    const deps = createHandler();
    handler = deps.handler;
    roleRepo = deps.roleRepo;
  });

  describe('getRoles', () => {
    it('tenantId로 페이지네이션된 역할 목록을 반환한다', async () => {
      roleRepo.list.mockResolvedValue({
        items: [makeRole('r-1', 'tenant-1'), makeRole('r-2', 'tenant-1')],
        total: 2,
      });

      const result = await handler.getRoles('tenant-1', { page: 1, limit: 10 });

      expect(roleRepo.list).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        page: 1,
        limit: 10,
      });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('page/limit 미지정 시 기본값(1/20)을 사용한다', async () => {
      roleRepo.list.mockResolvedValue({ items: [], total: 0 });

      await handler.getRoles('tenant-1', {});

      expect(roleRepo.list).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        page: 1,
        limit: 20,
      });
    });

    it('반환 항목에 description이 포함된다', async () => {
      roleRepo.list.mockResolvedValue({
        items: [makeRole('r-1', 'tenant-1')],
        total: 1,
      });

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

      await expect(handler.getRole('tenant-1', 'no-such')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('tenantId 불일치 시 NotFoundException을 던진다', async () => {
      roleRepo.findById.mockResolvedValue(makeRole('r-1', 'other-tenant'));

      await expect(handler.getRole('tenant-1', 'r-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

describe('AdminQueryHandler - Client', () => {
  let handler: AdminQueryHandler;
  let clientRepo: jest.Mocked<ClientRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    const deps = createHandler();
    handler = deps.handler;
    clientRepo = deps.clientRepo;
  });

  describe('getClients', () => {
    it('tenantId로 페이지네이션된 클라이언트 목록을 반환한다', async () => {
      clientRepo.list.mockResolvedValue({
        items: [makeClient('c-1', 'tenant-1'), makeClient('c-2', 'tenant-1')],
        total: 2,
      });

      const result = await handler.getClients('tenant-1', {
        page: 1,
        limit: 10,
      });

      expect(clientRepo.list).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        page: 1,
        limit: 10,
      });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('page/limit 미지정 시 기본값(1/20)을 사용한다', async () => {
      clientRepo.list.mockResolvedValue({ items: [], total: 0 });

      await handler.getClients('tenant-1', {});

      expect(clientRepo.list).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        page: 1,
        limit: 20,
      });
    });

    it('반환 항목에 신규 필드가 포함된다', async () => {
      clientRepo.list.mockResolvedValue({
        items: [makeClient('c-1', 'tenant-1')],
        total: 1,
      });

      const result = await handler.getClients('tenant-1', {
        page: 1,
        limit: 10,
      });
      const item = result.items[0];

      expect(item.applicationType).toBe('web');
      expect(item.backchannelLogoutUri).toBe(
        'https://app.example.com/bc-logout',
      );
      expect(item.frontchannelLogoutUri).toBeNull();
      expect(item.allowedResources).toEqual(['https://api.example.com']);
    });
  });

  describe('getClient', () => {
    it('tenantId + id로 클라이언트를 조회하여 반환한다', async () => {
      clientRepo.findById.mockResolvedValue(makeClient('c-1', 'tenant-1'));

      const result = await handler.getClient('tenant-1', 'c-1');

      expect(clientRepo.findById).toHaveBeenCalledWith('c-1');
      expect(result.id).toBe('c-1');
      expect(result.clientId).toBe('app-web');
      expect(result.applicationType).toBe('web');
      expect(result.allowedResources).toEqual(['https://api.example.com']);
    });

    it('클라이언트가 없으면 NotFoundException을 던진다', async () => {
      clientRepo.findById.mockResolvedValue(null);

      await expect(handler.getClient('tenant-1', 'no-such')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('tenantId 불일치 시 NotFoundException을 던진다', async () => {
      clientRepo.findById.mockResolvedValue(makeClient('c-1', 'other-tenant'));

      await expect(handler.getClient('tenant-1', 'c-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
