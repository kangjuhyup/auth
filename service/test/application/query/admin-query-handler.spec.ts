import { NotFoundException } from '@nestjs/common';
import { AdminQueryHandler } from '@application/queries/handlers/admin-query.handler';
import type {
  TenantRepository,
  GroupRepository,
  RoleRepository,
  PermissionRepository,
  ScopeRepository,
  CustomGrantRepository,
  RolePermissionRepository,
  RoleAssignmentRepository,
  ClientRepository,
  TenantConfigRepository,
  JwksKeyRepository,
  ClientAuthPolicyRepository,
  EventRepository,
  IdentityProviderRepository,
  ConsentRepository,
} from '@domain/repositories';
import type { UserWriteRepositoryPort } from '@application/commands/ports/user-write-repository.port';
import type { UserSessionPort } from '@application/ports/user-session.port';
import { TenantModel } from '@domain/models/tenant';
import { GroupModel } from '@domain/models/group';
import { RoleModel } from '@domain/models/role';
import { ClientModel } from '@domain/models/client';
import { ClientAuthPolicyModel } from '@domain/models/client-auth-policy';
import { PermissionModel } from '@domain/models/permission';
import { ScopeModel } from '@domain/models/scope';
import { CustomGrantModel } from '@domain/models/custom-grant';
import { JwksKeyModel } from '@domain/models/jwks-key';
import { EventModel } from '@domain/models/event';
import { UserModel } from '@domain/models/user';
import { TenantConfigModel } from '@domain/models/tenant-config';
import { ConsentModel } from '@domain/models/consent';

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
    introspectionResources: ['https://api.example.com'],
    skipConsent: false,
  });
  c.setPersistence(id, new Date('2024-01-01'), new Date('2024-01-01'));
  return c;
}

function makeCustomGrant(id: string, tenantId: string): CustomGrantModel {
  const grant = new CustomGrantModel({
    tenantId,
    grantType: 'urn:auth:grant-type:magic_link',
    displayName: 'Magic Link',
    description: null,
    enabled: true,
    allowedClientTypes: ['confidential'],
    allowedApplicationTypes: ['web'],
    requiresClientAuthentication: true,
    requiresGrantTypes: [],
    builtIn: false,
  });
  grant.setPersistence(id, new Date('2024-01-01'), new Date('2024-01-01'));
  return grant;
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

function createMockScopeRepo(): jest.Mocked<ScopeRepository> {
  return {
    findById: jest.fn(),
    findByName: jest.fn(),
    findByNames: jest.fn(),
    list: jest.fn(),
    listEnabledByTenantId: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

function createMockCustomGrantRepo(): jest.Mocked<CustomGrantRepository> {
  return {
    findById: jest.fn(),
    findByGrantType: jest.fn(),
    list: jest.fn(),
    listByTenantId: jest.fn(),
    listEnabledByTenantId: jest.fn(),
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
    findCredentialsByType: jest.fn().mockResolvedValue([]),
    createCredential: jest.fn().mockResolvedValue(undefined),
    saveCredential: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockIdentityProviderRepo(): jest.Mocked<IdentityProviderRepository> {
  return {
    findByTenantAndProvider: jest.fn().mockResolvedValue(null),
    listEnabledByTenant: jest.fn().mockResolvedValue([]),
    listByTenant: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    findByIdForTenant: jest.fn().mockResolvedValue(null),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

function createMockConsentRepo(): jest.Mocked<ConsentRepository> {
  return {
    findByTenantUserClient: jest.fn().mockResolvedValue(null),
    listAllByUser: jest.fn().mockResolvedValue([]),
    listByUser: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    save: jest.fn(),
    delete: jest.fn(),
  } as any;
}

function createMockUserSession(): jest.Mocked<UserSessionPort> {
  return {
    listUserSessions: jest.fn().mockResolvedValue([]),
    revokeUserSession: jest.fn().mockResolvedValue(0),
    revokeUserSessions: jest.fn().mockResolvedValue(0),
  };
}

function createHandler() {
  const tenantRepo = createMockTenantRepo();
  const groupRepo = createMockGroupRepo();
  const roleRepo = createMockRoleRepo();
  const permissionRepo = createMockPermissionRepo();
  const scopeRepo = createMockScopeRepo();
  const customGrantRepo = createMockCustomGrantRepo();
  const rolePermissionRepo = createMockRolePermissionRepo();
  const roleAssignmentRepo = createMockRoleAssignmentRepo();
  const clientRepo = createMockClientRepo();
  const tenantConfigRepo = createMockTenantConfigRepo();
  const jwksKeyRepo = createMockJwksKeyRepo();
  const clientAuthPolicyRepo = createMockClientAuthPolicyRepo();
  const eventRepo = createMockEventRepo();
  const userRepo = createMockUserRepo();
  const identityProviderRepo = createMockIdentityProviderRepo();
  const consentRepo = createMockConsentRepo();
  const userSession = createMockUserSession();

  const handler = new AdminQueryHandler(
    tenantRepo,
    groupRepo,
    roleRepo,
    permissionRepo,
    scopeRepo,
    customGrantRepo,
    rolePermissionRepo,
    roleAssignmentRepo,
    clientRepo,
    tenantConfigRepo,
    jwksKeyRepo,
    clientAuthPolicyRepo,
    eventRepo,
    userRepo,
    identityProviderRepo,
    consentRepo,
    userSession,
  );

  return {
    handler,
    tenantRepo,
    groupRepo,
    roleRepo,
    permissionRepo,
    scopeRepo,
    customGrantRepo,
    rolePermissionRepo,
    roleAssignmentRepo,
    clientRepo,
    tenantConfigRepo,
    jwksKeyRepo,
    clientAuthPolicyRepo,
    eventRepo,
    userRepo,
    identityProviderRepo,
    consentRepo,
    userSession,
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
      expect(item.introspectionResources).toEqual([
        'https://api.example.com',
      ]);
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
      expect(result.introspectionResources).toEqual([
        'https://api.example.com',
      ]);
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

// ── helper factories ─────────────────────────────────────────────────────────

function makeClientAuthPolicy(clientRefId: string): ClientAuthPolicyModel {
  const p = new ClientAuthPolicyModel({
    tenantId: 'tenant-1',
    clientRefId,
    allowedAuthMethods: ['password'],
    defaultAcr: 'urn:mace:incommon:iap:bronze',
    mfaRequired: false,
    allowedMfaMethods: ['totp'],
    maxSessionDurationSec: 3600,
    consentRequired: true,
    requireAuthTime: false,
    allowedIdpProviderKeys: ['okta'],
    reauthenticationIntervalSec: 1800,
    refreshTokenRotationEnabled: true,
    refreshTokenReuseAction: 'revoke_grant',
  });
  p.setPersistence('policy-1', new Date('2024-01-01'), new Date('2024-01-01'));
  return p;
}

function makePermission(id: string, tenantId: string): PermissionModel {
  const p = new PermissionModel({
    tenantId,
    code: 'read:users',
    resource: 'users',
    action: 'read',
    description: null,
  });
  p.setPersistence(id, new Date('2024-01-01'), new Date('2024-01-01'));
  return p;
}

function makeScope(id: string, tenantId: string): ScopeModel {
  const s = new ScopeModel({
    tenantId,
    name: 'orders:read',
    displayName: 'Read orders',
    description: 'Allow reading order data',
    claimKeys: ['profile'],
    enabled: true,
    builtIn: false,
  });
  s.setPersistence(id, new Date('2024-01-01'), new Date('2024-01-01'));
  return s;
}

function makeJwksKey(kid: string): JwksKeyModel {
  return new JwksKeyModel({
    kid,
    tenantId: 'tenant-1',
    algorithm: 'RS256',
    publicKey: 'pub-pem',
    privateKeyEnc: 'enc-priv',
    status: 'active',
    rotatedAt: null,
    expiresAt: null,
    createdAt: new Date('2024-01-01'),
  });
}

function makeEvent(id: string): EventModel {
  return new EventModel(
    {
      tenantId: 'tenant-1',
      category: 'AUTH',
      severity: 'INFO',
      action: 'LOGIN',
      success: true,
      occurredAt: new Date('2024-01-01'),
    },
    id,
  );
}

function makeUser(id: string, tenantId: string): UserModel {
  return UserModel.of({
    id,
    tenantId,
    username: 'testuser',
    email: 'test@example.com',
    emailVerified: false,
    phone: null,
    phoneVerified: false,
    status: 'ACTIVE',
  });
}

function makeConsent(
  id: string,
  props: Partial<{
    tenantId: string;
    userId: string;
    clientRefId: string;
    clientId: string;
    clientName: string;
    grantedScopes: string;
    grantedAt: Date;
    revokedAt: Date | null;
  }> = {},
): ConsentModel {
  return new ConsentModel(
    {
      tenantId: props.tenantId ?? 'tenant-1',
      userId: props.userId ?? 'u-1',
      clientRefId: props.clientRefId ?? 'client-ref-1',
      clientId: props.clientId ?? 'app-web',
      clientName: props.clientName ?? 'Web App',
      grantedScopes: props.grantedScopes ?? 'openid profile email',
      grantedAt: props.grantedAt ?? new Date('2024-03-01T00:00:00Z'),
      revokedAt: props.revokedAt ?? null,
    },
    id,
  );
}

function makeTenantConfig(tenantId: string): TenantConfigModel {
  return new TenantConfigModel({
    tenantId,
    signupPolicy: 'open',
    requirePhoneVerify: true,
    brandName: 'Test Brand',
    accessTokenTtlSec: 3600,
    refreshTokenTtlSec: 86400,
    extra: { foo: 'bar' },
  });
}

// ── ClientAuthPolicy ──────────────────────────────────────────────────────────

describe('AdminQueryHandler - ClientAuthPolicy', () => {
  let handler: AdminQueryHandler;
  let clientRepo: jest.Mocked<ClientRepository>;
  let clientAuthPolicyRepo: jest.Mocked<ClientAuthPolicyRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    const deps = createHandler();
    handler = deps.handler;
    clientRepo = deps.clientRepo;
    clientAuthPolicyRepo = deps.clientAuthPolicyRepo;
  });

  describe('getClientAuthPolicy', () => {
    it('클라이언트가 없으면 NotFoundException을 던진다', async () => {
      clientRepo.findById.mockResolvedValue(null);

      await expect(
        handler.getClientAuthPolicy('tenant-1', 'c-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('tenantId 불일치 시 NotFoundException을 던진다', async () => {
      clientRepo.findById.mockResolvedValue(makeClient('c-1', 'other-tenant'));

      await expect(
        handler.getClientAuthPolicy('tenant-1', 'c-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('policy가 없으면 NotFoundException을 던진다', async () => {
      clientRepo.findById.mockResolvedValue(makeClient('c-1', 'tenant-1'));
      clientAuthPolicyRepo.findByClientRefId.mockResolvedValue(null);

      await expect(
        handler.getClientAuthPolicy('tenant-1', 'c-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('policy 반환 성공', async () => {
      clientRepo.findById.mockResolvedValue(makeClient('c-1', 'tenant-1'));
      clientAuthPolicyRepo.findByClientRefId.mockResolvedValue(
        makeClientAuthPolicy('c-1'),
      );

      const result = await handler.getClientAuthPolicy('tenant-1', 'c-1');

      expect(result.clientRefId).toBe('c-1');
      expect(result.allowedAuthMethods).toEqual(['password']);
      expect(result.mfaRequired).toBe(false);
      expect(result.consentRequired).toBe(true);
      expect(result.refreshTokenRotationEnabled).toBe(true);
      expect(result.refreshTokenReuseAction).toBe('revoke_grant');
      expect(result.allowedIdpProviderKeys).toEqual(['okta']);
      expect(result.reauthenticationIntervalSec).toBe(1800);
      expect(result.loginSessionMode).toBeNull();
      expect(result.maxConcurrentSessions).toBeNull();
      expect(result.sessionConflictAction).toBeNull();
      expect(result.effective).toEqual({
        mfaRequired: false,
        allowedIdpProviderKeys: ['okta'],
        maxSessionDurationSec: 3600,
        requireAuthTime: false,
        reauthenticationIntervalSec: 1800,
        refreshTokenTtlSec: 14 * 24 * 60 * 60,
        loginSessionMode: 'multi',
        maxConcurrentSessions: null,
        sessionConflictAction: 'revoke_previous_sessions',
      });
    });
  });
});

// ── Keys & Policies ──────────────────────────────────────────────────────────

describe('AdminQueryHandler - Keys & Policies', () => {
  let handler: AdminQueryHandler;
  let jwksKeyRepo: jest.Mocked<JwksKeyRepository>;
  let tenantConfigRepo: jest.Mocked<TenantConfigRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    const deps = createHandler();
    handler = deps.handler;
    jwksKeyRepo = deps.jwksKeyRepo;
    tenantConfigRepo = deps.tenantConfigRepo;
  });

  describe('getKeys', () => {
    it('active 키 목록을 매핑하여 반환한다', async () => {
      jwksKeyRepo.findActiveByTenantId.mockResolvedValue([
        makeJwksKey('kid-1'),
        makeJwksKey('kid-2'),
      ]);

      const result = await handler.getKeys('tenant-1');

      expect(jwksKeyRepo.findActiveByTenantId).toHaveBeenCalledWith('tenant-1');
      expect(result).toHaveLength(2);
      const first = result[0] as Record<string, unknown>;
      expect(first['kid']).toBe('kid-1');
      expect(first['algorithm']).toBe('RS256');
      expect(first['status']).toBe('active');
      expect(first['rotatedAt']).toBeNull();
    });

    it('키가 없으면 빈 배열 반환', async () => {
      jwksKeyRepo.findActiveByTenantId.mockResolvedValue([]);

      const result = await handler.getKeys('tenant-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('getPolicies', () => {
    it('config 있으면 실제 값 반환', async () => {
      tenantConfigRepo.findByTenantId.mockResolvedValue(
        makeTenantConfig('tenant-1'),
      );

      const result = await handler.getPolicies('tenant-1');

      expect(result.signup.mode).toBe('open');
      expect(result.refreshToken.ttlSec).toBe(86400);
      expect(result.password.minLength).toBe(12);
      expect(result.mfa.adminRequired).toBe(true);
    });

    it('config 없으면 기본값 반환', async () => {
      tenantConfigRepo.findByTenantId.mockResolvedValue(null);

      const result = await handler.getPolicies('tenant-1');

      expect(result.signup.mode).toBe('open');
      expect(result.refreshToken.ttlSec).toBe(14 * 24 * 60 * 60);
      expect(result.allowedIdp.providerKeys).toBeNull();
    });
  });
});

// ── AuditLogs ────────────────────────────────────────────────────────────────

describe('AdminQueryHandler - AuditLogs', () => {
  let handler: AdminQueryHandler;
  let eventRepo: jest.Mocked<EventRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    const deps = createHandler();
    handler = deps.handler;
    eventRepo = deps.eventRepo;
  });

  describe('getAuditLogs', () => {
    it('페이지네이션된 이벤트 목록을 반환한다', async () => {
      eventRepo.list.mockResolvedValue({
        items: [makeEvent('e-1'), makeEvent('e-2')],
        total: 2,
      });

      const result = await handler.getAuditLogs('tenant-1', {
        page: 1,
        limit: 10,
      });

      expect(eventRepo.list).toHaveBeenCalledWith({
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
      eventRepo.list.mockResolvedValue({ items: [], total: 0 });

      await handler.getAuditLogs('tenant-1', {});

      expect(eventRepo.list).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        page: 1,
        limit: 20,
      });
    });

    it('AuditLog 필터를 repository query로 전달한다', async () => {
      eventRepo.list.mockResolvedValue({ items: [], total: 0 });

      await handler.getAuditLogs('tenant-1', {
        page: 1,
        limit: 10,
        from: '2024-01-01T00:00:00.000Z',
        to: '2024-01-31T23:59:59.000Z',
        userId: 'user-1',
        clientId: 'client-1',
        category: 'SECURITY',
        action: 'ACCESS_DENIED',
        severity: 'WARN',
        correlationId: 'req-1',
      });

      expect(eventRepo.list).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        page: 1,
        limit: 10,
        from: new Date('2024-01-01T00:00:00.000Z'),
        to: new Date('2024-01-31T23:59:59.000Z'),
        userId: 'user-1',
        clientId: 'client-1',
        category: 'SECURITY',
        action: 'ACCESS_DENIED',
        severity: 'WARN',
        correlationId: 'req-1',
      });
    });

    it('반환 항목에 필수 필드가 포함된다', async () => {
      eventRepo.list.mockResolvedValue({
        items: [makeEvent('e-1')],
        total: 1,
      });

      const result = await handler.getAuditLogs('tenant-1', {
        page: 1,
        limit: 10,
      });
      const item = result.items[0];

      expect(item['id']).toBe('e-1');
      expect(item['category']).toBe('AUTH');
      expect(item['action']).toBe('LOGIN');
      expect(item['success']).toBe(true);
      expect(item['correlationId']).toBeNull();
    });
  });
});

// ── Users ────────────────────────────────────────────────────────────────────

describe('AdminQueryHandler - Users', () => {
  let handler: AdminQueryHandler;
  let userRepo: jest.Mocked<UserWriteRepositoryPort>;
  let consentRepo: jest.Mocked<ConsentRepository>;
  let userSession: jest.Mocked<UserSessionPort>;

  beforeEach(() => {
    jest.clearAllMocks();
    const deps = createHandler();
    handler = deps.handler;
    userRepo = deps.userRepo;
    consentRepo = deps.consentRepo;
    userSession = deps.userSession;
  });

  describe('getUsers', () => {
    it('페이지네이션된 사용자 목록을 반환한다', async () => {
      userRepo.list.mockResolvedValue({
        items: [makeUser('u-1', 'tenant-1'), makeUser('u-2', 'tenant-1')],
        total: 2,
      });

      const result = await handler.getUsers('tenant-1', { page: 1, limit: 10 });

      expect(userRepo.list).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        page: 1,
        limit: 10,
      });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('반환 항목에 필수 필드가 포함된다', async () => {
      userRepo.list.mockResolvedValue({
        items: [makeUser('u-1', 'tenant-1')],
        total: 1,
      });

      const result = await handler.getUsers('tenant-1', { page: 1, limit: 10 });
      const item = result.items[0];

      expect(item.id).toBe('u-1');
      expect(item.username).toBe('testuser');
      expect(item.status).toBe('ACTIVE');
      expect(item.mfaEnabled).toBe(false);
    });

    it('검색어가 있으면 사용자 저장소에 함께 전달한다', async () => {
      userRepo.list.mockResolvedValue({
        items: [makeUser('u-1', 'tenant-1')],
        total: 1,
      });

      await handler.getUsers('tenant-1', {
        page: 1,
        limit: 10,
        search: 'alice',
      });

      expect(userRepo.list).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        page: 1,
        limit: 10,
        search: 'alice',
      });
    });
  });

  describe('getUser', () => {
    it('id로 사용자를 조회하여 반환한다', async () => {
      userRepo.findById.mockResolvedValue(makeUser('u-1', 'tenant-1'));

      const result = await handler.getUser('tenant-1', 'u-1');

      expect(userRepo.findById).toHaveBeenCalledWith('u-1');
      expect(result.id).toBe('u-1');
    });

    it('사용자가 없으면 NotFoundException을 던진다', async () => {
      userRepo.findById.mockResolvedValue(undefined);

      await expect(handler.getUser('tenant-1', 'no-such')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('tenantId 불일치 시 NotFoundException을 던진다', async () => {
      userRepo.findById.mockResolvedValue(makeUser('u-1', 'other-tenant'));

      await expect(handler.getUser('tenant-1', 'u-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserConsents', () => {
    it('사용자의 활성 Consent 목록을 반환한다', async () => {
      userRepo.findById.mockResolvedValue(makeUser('u-1', 'tenant-1'));
      consentRepo.listByUser.mockResolvedValue({
        items: [makeConsent('consent-1')],
        total: 1,
      });

      const result = await handler.getUserConsents('tenant-1', 'u-1', {
        page: 1,
        limit: 10,
      });

      expect(userRepo.findById).toHaveBeenCalledWith('u-1');
      expect(consentRepo.listByUser).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'u-1',
        page: 1,
        limit: 10,
      });
      expect(result.items[0]).toMatchObject({
        id: 'consent-1',
        userId: 'u-1',
        clientRefId: 'client-ref-1',
        clientId: 'app-web',
        clientName: 'Web App',
        grantedScopes: 'openid profile email',
        status: 'ACTIVE',
        revokedAt: null,
      });
    });

    it('사용자가 테넌트에 없으면 NotFoundException을 던진다', async () => {
      userRepo.findById.mockResolvedValue(makeUser('u-1', 'other-tenant'));

      await expect(
        handler.getUserConsents('tenant-1', 'u-1', { page: 1, limit: 10 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(consentRepo.listByUser).not.toHaveBeenCalled();
    });
  });

  describe('getUserConsentHistory', () => {
    it('revoked Consent 를 포함한 이력을 반환한다', async () => {
      const revokedAt = new Date('2024-03-10T00:00:00Z');
      userRepo.findById.mockResolvedValue(makeUser('u-1', 'tenant-1'));
      consentRepo.listByUser.mockResolvedValue({
        items: [makeConsent('consent-2', { revokedAt })],
        total: 1,
      });

      const result = await handler.getUserConsentHistory('tenant-1', 'u-1', {
        page: 2,
        limit: 5,
      });

      expect(consentRepo.listByUser).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'u-1',
        page: 2,
        limit: 5,
        includeRevoked: true,
      });
      expect(result.items[0]).toMatchObject({
        id: 'consent-2',
        status: 'REVOKED',
        revokedAt,
      });
    });
  });

  describe('getUserSessions', () => {
    it('사용자 세션 목록을 조회한다', async () => {
      const createdAt = new Date('2026-06-06T01:00:00Z');
      const expiresAt = new Date('2026-06-07T01:00:00Z');
      userRepo.findById.mockResolvedValue(makeUser('u-1', 'tenant-1'));
      userSession.listUserSessions.mockResolvedValue([
        {
          sessionId: 'session-1',
          tenantId: 'tenant-1',
          userId: 'u-1',
          clientId: 'web-app',
          createdAt,
          expiresAt,
        },
      ]);

      const result = await handler.getUserSessions('tenant-1', 'u-1');

      expect(userRepo.findById).toHaveBeenCalledWith('u-1');
      expect(userSession.listUserSessions).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'u-1',
      });
      expect(result[0]).toMatchObject({
        sessionId: 'session-1',
        userId: 'u-1',
        clientId: 'web-app',
        createdAt,
        expiresAt,
      });
    });
  });
});

// ── Permissions ──────────────────────────────────────────────────────────────

describe('AdminQueryHandler - Permissions', () => {
  let handler: AdminQueryHandler;
  let permissionRepo: jest.Mocked<PermissionRepository>;
  let rolePermissionRepo: jest.Mocked<RolePermissionRepository>;
  let roleRepo: jest.Mocked<RoleRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    const deps = createHandler();
    handler = deps.handler;
    permissionRepo = deps.permissionRepo;
    rolePermissionRepo = deps.rolePermissionRepo;
    roleRepo = deps.roleRepo;
  });

  describe('getPermissions', () => {
    it('페이지네이션된 권한 목록을 반환한다', async () => {
      permissionRepo.list.mockResolvedValue({
        items: [makePermission('p-1', 'tenant-1')],
        total: 1,
      });

      const result = await handler.getPermissions('tenant-1', {
        page: 1,
        limit: 10,
      });

      expect(permissionRepo.list).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        page: 1,
        limit: 10,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].code).toBe('read:users');
    });
  });

  describe('getPermission', () => {
    it('id로 권한을 조회하여 반환한다', async () => {
      permissionRepo.findById.mockResolvedValue(
        makePermission('p-1', 'tenant-1'),
      );

      const result = await handler.getPermission('tenant-1', 'p-1');

      expect(result.id).toBe('p-1');
      expect(result.code).toBe('read:users');
      expect(result.resource).toBe('users');
    });

    it('권한이 없으면 NotFoundException을 던진다', async () => {
      permissionRepo.findById.mockResolvedValue(null);

      await expect(
        handler.getPermission('tenant-1', 'no-such'),
      ).rejects.toThrow(NotFoundException);
    });

    it('tenantId 불일치 시 NotFoundException을 던진다', async () => {
      permissionRepo.findById.mockResolvedValue(
        makePermission('p-1', 'other-tenant'),
      );

      await expect(handler.getPermission('tenant-1', 'p-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getRolePermissions', () => {
    it('역할이 없으면 NotFoundException을 던진다', async () => {
      roleRepo.findById.mockResolvedValue(null);

      await expect(
        handler.getRolePermissions('tenant-1', 'r-1', { page: 1, limit: 10 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('tenantId 불일치 시 NotFoundException을 던진다', async () => {
      roleRepo.findById.mockResolvedValue(makeRole('r-1', 'other-tenant'));

      await expect(
        handler.getRolePermissions('tenant-1', 'r-1', { page: 1, limit: 10 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('역할의 권한 목록을 반환한다', async () => {
      roleRepo.findById.mockResolvedValue(makeRole('r-1', 'tenant-1'));
      rolePermissionRepo.listByRole.mockResolvedValue({
        items: [makePermission('p-1', 'tenant-1')],
        total: 1,
      });

      const result = await handler.getRolePermissions('tenant-1', 'r-1', {
        page: 1,
        limit: 10,
      });

      expect(rolePermissionRepo.listByRole).toHaveBeenCalledWith({
        roleId: 'r-1',
        page: 1,
        limit: 10,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].code).toBe('read:users');
    });
  });
});

describe('AdminQueryHandler - Scopes', () => {
  let handler: AdminQueryHandler;
  let scopeRepo: jest.Mocked<ScopeRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    const deps = createHandler();
    handler = deps.handler;
    scopeRepo = deps.scopeRepo;
  });

  it('페이지네이션된 scope 목록을 반환한다', async () => {
    scopeRepo.list.mockResolvedValue({
      items: [makeScope('scope-1', 'tenant-1')],
      total: 1,
    });

    const result = await handler.getScopes('tenant-1', {
      page: 1,
      limit: 10,
    });

    expect(scopeRepo.list).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      page: 1,
      limit: 10,
    });
    expect(result.items[0]).toMatchObject({
      id: 'scope-1',
      name: 'orders:read',
      claimKeys: ['profile'],
    });
  });

  it('tenantId 불일치 scope 조회는 NotFoundException을 던진다', async () => {
    scopeRepo.findById.mockResolvedValue(makeScope('scope-1', 'other-tenant'));

    await expect(handler.getScope('tenant-1', 'scope-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('AdminQueryHandler - Custom Grants', () => {
  let handler: AdminQueryHandler;
  let customGrantRepo: jest.Mocked<CustomGrantRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    const deps = createHandler();
    handler = deps.handler;
    customGrantRepo = deps.customGrantRepo;
  });

  it('페이지네이션된 custom grant 목록을 반환한다', async () => {
    customGrantRepo.list.mockResolvedValue({
      items: [makeCustomGrant('grant-1', 'tenant-1')],
      total: 1,
    });

    const result = await handler.getCustomGrants('tenant-1', {
      page: 1,
      limit: 10,
    });

    expect(customGrantRepo.list).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      page: 1,
      limit: 10,
    });
    expect(result.items[0]).toMatchObject({
      id: 'grant-1',
      grantType: 'urn:auth:grant-type:magic_link',
      allowedClientTypes: ['confidential'],
    });
  });

  it('tenantId 불일치 custom grant 조회는 NotFoundException을 던진다', async () => {
    customGrantRepo.findById.mockResolvedValue(
      makeCustomGrant('grant-1', 'other-tenant'),
    );

    await expect(handler.getCustomGrant('tenant-1', 'grant-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});

// ── GroupRoles & UserRoles ────────────────────────────────────────────────────

describe('AdminQueryHandler - GroupRoles & UserRoles', () => {
  let handler: AdminQueryHandler;
  let groupRepo: jest.Mocked<GroupRepository>;
  let roleAssignmentRepo: jest.Mocked<RoleAssignmentRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    const deps = createHandler();
    handler = deps.handler;
    groupRepo = deps.groupRepo;
    roleAssignmentRepo = deps.roleAssignmentRepo;
  });

  describe('getGroupRoles', () => {
    it('그룹이 없으면 NotFoundException을 던진다', async () => {
      groupRepo.findById.mockResolvedValue(null);

      await expect(handler.getGroupRoles('tenant-1', 'g-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('tenantId 불일치 시 NotFoundException을 던진다', async () => {
      groupRepo.findById.mockResolvedValue(makeGroup('g-1', 'other-tenant'));

      await expect(handler.getGroupRoles('tenant-1', 'g-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('그룹의 역할 목록을 반환한다', async () => {
      groupRepo.findById.mockResolvedValue(makeGroup('g-1', 'tenant-1'));
      roleAssignmentRepo.listForGroup.mockResolvedValue([
        makeRole('r-1', 'tenant-1'),
        makeRole('r-2', 'tenant-1'),
      ]);

      const result = await handler.getGroupRoles('tenant-1', 'g-1');

      expect(roleAssignmentRepo.listForGroup).toHaveBeenCalledWith('g-1');
      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('admin');
    });
  });

  describe('getUserRoles', () => {
    it('사용자의 역할 목록을 반환한다', async () => {
      roleAssignmentRepo.listForUser.mockResolvedValue([
        makeRole('r-1', 'tenant-1'),
      ]);

      const result = await handler.getUserRoles('tenant-1', 'u-1');

      expect(roleAssignmentRepo.listForUser).toHaveBeenCalledWith('u-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('r-1');
    });

    it('역할이 없으면 빈 배열 반환', async () => {
      roleAssignmentRepo.listForUser.mockResolvedValue([]);

      const result = await handler.getUserRoles('tenant-1', 'u-1');

      expect(result).toHaveLength(0);
    });
  });
});
