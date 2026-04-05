import type { PaginatedResult } from '@/types/pagination.types';
import type {
  TenantResponse,
  CreateTenantDto,
  UpdateTenantDto,
} from '@/types/tenant.types';
import type {
  ClientResponse,
  CreateClientDto,
  UpdateClientDto,
} from '@/types/client.types';
import type {
  RoleResponse,
  CreateRoleDto,
  UpdateRoleDto,
} from '@/types/role.types';
import type {
  GroupResponse,
  CreateGroupDto,
  UpdateGroupDto,
} from '@/types/group.types';
import type {
  UserResponse,
  CreateUserDto,
  UpdateUserDto,
} from '@/types/user.types';
import type { LoginDto, LoginResponse } from '@/types/auth.types';

// Simulate network delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ============================================================================
// MOCK DATA STORAGE
// ============================================================================

// Tenants (not tenant-scoped)
const mockTenants: TenantResponse[] = [
  {
    id: '1',
    code: 'default',
    name: 'Default Tenant',
    signupPolicy: 'invite',
    requirePhoneVerify: true,
    brandName: 'My Auth Server',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    code: 'acme',
    name: 'ACME Corporation',
    signupPolicy: 'open',
    requirePhoneVerify: false,
    brandName: 'ACME',
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
  },
  {
    id: '3',
    code: 'globex',
    name: 'Globex Corporation',
    signupPolicy: 'invite',
    requirePhoneVerify: true,
    brandName: 'Globex',
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-01'),
  },
];

// Clients (tenant-scoped)
const mockClients: ClientResponse[] = [
  {
    id: '1',
    clientId: 'web-app',
    name: 'Web Application',
    type: 'public',
    enabled: true,
    redirectUris: ['http://localhost:3000/callback'],
    grantTypes: ['authorization_code', 'refresh_token'],
    responseTypes: ['code'],
    tokenEndpointAuthMethod: 'none',
    scope: 'openid profile email',
    postLogoutRedirectUris: ['http://localhost:3000'],
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    clientId: 'mobile-app',
    name: 'Mobile Application',
    type: 'public',
    enabled: true,
    redirectUris: ['myapp://callback'],
    grantTypes: ['authorization_code', 'refresh_token'],
    responseTypes: ['code'],
    tokenEndpointAuthMethod: 'none',
    scope: 'openid profile email offline_access',
    postLogoutRedirectUris: ['myapp://logout'],
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
  },
  {
    id: '3',
    clientId: 'api-service',
    name: 'Backend API Service',
    type: 'confidential',
    enabled: true,
    redirectUris: [],
    grantTypes: ['client_credentials'],
    responseTypes: [],
    tokenEndpointAuthMethod: 'client_secret_post',
    scope: 'api:read api:write',
    postLogoutRedirectUris: [],
    createdAt: new Date('2024-02-15'),
    updatedAt: new Date('2024-02-15'),
  },
];

// Roles (tenant-scoped)
const mockRoles: RoleResponse[] = [
  {
    id: '1',
    code: 'admin',
    name: 'Administrator',
    description: 'Full system access',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    code: 'user',
    name: 'User',
    description: 'Standard user access',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: '3',
    code: 'viewer',
    name: 'Viewer',
    description: 'Read-only access',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: '4',
    code: 'moderator',
    name: 'Moderator',
    description: 'Content moderation access',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

// Groups (tenant-scoped)
const mockGroups: GroupResponse[] = [
  {
    id: '1',
    code: 'engineering',
    name: 'Engineering',
    parentId: null,
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-05'),
  },
  {
    id: '2',
    code: 'frontend-team',
    name: 'Frontend Team',
    parentId: '1',
    createdAt: new Date('2024-01-06'),
    updatedAt: new Date('2024-01-06'),
  },
  {
    id: '3',
    code: 'backend-team',
    name: 'Backend Team',
    parentId: '1',
    createdAt: new Date('2024-01-06'),
    updatedAt: new Date('2024-01-06'),
  },
  {
    id: '4',
    code: 'marketing',
    name: 'Marketing',
    parentId: null,
    createdAt: new Date('2024-01-07'),
    updatedAt: new Date('2024-01-07'),
  },
];

// Users (tenant-scoped)
const mockUsers: UserResponse[] = [
  {
    id: '1',
    username: 'admin',
    email: 'admin@example.com',
    emailVerified: true,
    phone: '+821012345678',
    phoneVerified: true,
    status: 'ACTIVE',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    username: 'john.doe',
    email: 'john.doe@example.com',
    emailVerified: true,
    phone: null,
    phoneVerified: false,
    status: 'ACTIVE',
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10'),
  },
  {
    id: '3',
    username: 'jane.smith',
    email: 'jane.smith@example.com',
    emailVerified: false,
    phone: '+821098765432',
    phoneVerified: true,
    status: 'ACTIVE',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: '4',
    username: 'locked.user',
    email: 'locked@example.com',
    emailVerified: true,
    phone: null,
    phoneVerified: false,
    status: 'LOCKED',
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-10'),
  },
  {
    id: '5',
    username: 'disabled.user',
    email: 'disabled@example.com',
    emailVerified: true,
    phone: null,
    phoneVerified: false,
    status: 'DISABLED',
    createdAt: new Date('2024-02-05'),
    updatedAt: new Date('2024-02-15'),
  },
];

// Role assignments (Map<resourceId, roleIds[]>)
const mockGroupRoles = new Map<string, string[]>([
  ['1', ['1']], // Engineering has Admin role
  ['2', ['2']], // Frontend Team has User role
  ['3', ['2']], // Backend Team has User role
  ['4', ['3']], // Marketing has Viewer role
]);

const mockUserRoles = new Map<string, string[]>([
  ['1', ['1']], // admin user has Admin role
  ['2', ['2']], // john.doe has User role
  ['3', ['2', '4']], // jane.smith has User and Moderator roles
  ['4', ['3']], // locked.user has Viewer role
  ['5', ['3']], // disabled.user has Viewer role
]);

// ============================================================================
// AUTHENTICATION API
// ============================================================================

export const mockAuthApi = {
  login: async (dto: LoginDto): Promise<LoginResponse> => {
    await delay(500);

    // Mock credentials: admin/admin
    if (dto.username === 'admin' && dto.password === 'admin') {
      return {
        token: 'mock-jwt-token-' + Date.now(),
        username: dto.username,
      };
    }

    throw new Error('Invalid credentials');
  },

  logout: async (): Promise<void> => {
    await delay(200);
    // Nothing to do for mock
  },
};

// ============================================================================
// TENANT API
// ============================================================================

export const mockTenantApi = {
  list: async (params: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<TenantResponse>> => {
    await delay(300);
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const start = (page - 1) * limit;
    const items = mockTenants.slice(start, start + limit);

    return {
      items,
      total: mockTenants.length,
      page,
      limit,
    };
  },

  get: async (id: string): Promise<TenantResponse> => {
    await delay(200);
    const tenant = mockTenants.find((t) => t.id === id);
    if (!tenant) throw new Error('Tenant not found');
    return tenant;
  },

  create: async (dto: CreateTenantDto): Promise<{ id: string }> => {
    await delay(400);
    const id = String(mockTenants.length + 1);
    mockTenants.push({
      id,
      ...dto,
      signupPolicy: dto.signupPolicy ?? 'invite',
      requirePhoneVerify: dto.requirePhoneVerify ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { id };
  },

  update: async (id: string, dto: UpdateTenantDto): Promise<void> => {
    await delay(400);
    const index = mockTenants.findIndex((t) => t.id === id);
    if (index === -1) throw new Error('Tenant not found');
    const prev = mockTenants[index]!;
    mockTenants[index] = {
      ...prev,
      ...dto,
      id: prev.id,
      updatedAt: new Date(),
    } as TenantResponse;
  },

  delete: async (id: string): Promise<void> => {
    await delay(300);
    const index = mockTenants.findIndex((t) => t.id === id);
    if (index === -1) throw new Error('Tenant not found');
    mockTenants.splice(index, 1);
  },
};

// ============================================================================
// CLIENT API
// ============================================================================

export const mockClientApi = {
  list: async (params: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<ClientResponse>> => {
    await delay(300);
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const start = (page - 1) * limit;
    const items = mockClients.slice(start, start + limit);

    return {
      items,
      total: mockClients.length,
      page,
      limit,
    };
  },

  get: async (id: string): Promise<ClientResponse> => {
    await delay(200);
    const client = mockClients.find((c) => c.id === id);
    if (!client) throw new Error('Client not found');
    return client;
  },

  create: async (dto: CreateClientDto): Promise<{ id: string }> => {
    await delay(400);
    const id = String(mockClients.length + 1);
    mockClients.push({
      id,
      ...dto,
      type: dto.type ?? 'public',
      enabled: true,
      redirectUris: dto.redirectUris ?? [],
      grantTypes: dto.grantTypes ?? ['authorization_code'],
      responseTypes: dto.responseTypes ?? ['code'],
      tokenEndpointAuthMethod: dto.tokenEndpointAuthMethod ?? 'none',
      scope: dto.scope ?? 'openid profile email',
      postLogoutRedirectUris: dto.postLogoutRedirectUris ?? [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { id };
  },

  update: async (id: string, dto: UpdateClientDto): Promise<void> => {
    await delay(400);
    const index = mockClients.findIndex((c) => c.id === id);
    if (index === -1) throw new Error('Client not found');
    const prev = mockClients[index]!;
    mockClients[index] = {
      ...prev,
      ...dto,
      id: prev.id,
      updatedAt: new Date(),
    } as ClientResponse;
  },

  delete: async (id: string): Promise<void> => {
    await delay(300);
    const index = mockClients.findIndex((c) => c.id === id);
    if (index === -1) throw new Error('Client not found');
    mockClients.splice(index, 1);
  },
};

// ============================================================================
// ROLE API
// ============================================================================

export const mockRoleApi = {
  list: async (params: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<RoleResponse>> => {
    await delay(300);
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const start = (page - 1) * limit;
    const items = mockRoles.slice(start, start + limit);

    return {
      items,
      total: mockRoles.length,
      page,
      limit,
    };
  },

  get: async (id: string): Promise<RoleResponse> => {
    await delay(200);
    const role = mockRoles.find((r) => r.id === id);
    if (!role) throw new Error('Role not found');
    return role;
  },

  create: async (dto: CreateRoleDto): Promise<{ id: string }> => {
    await delay(400);
    const id = String(mockRoles.length + 1);
    mockRoles.push({
      id,
      ...dto,
      description: dto.description ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { id };
  },

  update: async (id: string, dto: UpdateRoleDto): Promise<void> => {
    await delay(400);
    const index = mockRoles.findIndex((r) => r.id === id);
    if (index === -1) throw new Error('Role not found');
    const prev = mockRoles[index]!;
    mockRoles[index] = {
      ...prev,
      ...dto,
      id: prev.id,
      updatedAt: new Date(),
    } as RoleResponse;
  },

  delete: async (id: string): Promise<void> => {
    await delay(300);
    const index = mockRoles.findIndex((r) => r.id === id);
    if (index === -1) throw new Error('Role not found');
    mockRoles.splice(index, 1);
  },
};

// ============================================================================
// GROUP API
// ============================================================================

export const mockGroupApi = {
  list: async (params: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<GroupResponse>> => {
    await delay(300);
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const start = (page - 1) * limit;
    const items = mockGroups.slice(start, start + limit);

    return {
      items,
      total: mockGroups.length,
      page,
      limit,
    };
  },

  get: async (id: string): Promise<GroupResponse> => {
    await delay(200);
    const group = mockGroups.find((g) => g.id === id);
    if (!group) throw new Error('Group not found');
    return group;
  },

  create: async (dto: CreateGroupDto): Promise<{ id: string }> => {
    await delay(400);
    const id = String(mockGroups.length + 1);
    mockGroups.push({
      id,
      ...dto,
      parentId: dto.parentId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { id };
  },

  update: async (id: string, dto: UpdateGroupDto): Promise<void> => {
    await delay(400);
    const index = mockGroups.findIndex((g) => g.id === id);
    if (index === -1) throw new Error('Group not found');
    const prev = mockGroups[index]!;
    mockGroups[index] = {
      ...prev,
      ...dto,
      id: prev.id,
      updatedAt: new Date(),
    } as GroupResponse;
  },

  delete: async (id: string): Promise<void> => {
    await delay(300);
    const index = mockGroups.findIndex((g) => g.id === id);
    if (index === -1) throw new Error('Group not found');
    mockGroups.splice(index, 1);
  },

  // Role assignment endpoints
  getRoles: async (groupId: string): Promise<RoleResponse[]> => {
    await delay(200);
    const roleIds = mockGroupRoles.get(groupId) ?? [];
    return mockRoles.filter((r) => roleIds.includes(r.id));
  },

  addRole: async (groupId: string, roleId: string): Promise<void> => {
    await delay(300);
    const existing = mockGroupRoles.get(groupId) ?? [];
    if (!existing.includes(roleId)) {
      mockGroupRoles.set(groupId, [...existing, roleId]);
    }
  },

  removeRole: async (groupId: string, roleId: string): Promise<void> => {
    await delay(300);
    const existing = mockGroupRoles.get(groupId) ?? [];
    mockGroupRoles.set(
      groupId,
      existing.filter((id) => id !== roleId),
    );
  },
};

// ============================================================================
// USER API
// ============================================================================

export const mockUserApi = {
  list: async (params: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<UserResponse>> => {
    await delay(300);
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const start = (page - 1) * limit;
    const items = mockUsers.slice(start, start + limit);

    return {
      items,
      total: mockUsers.length,
      page,
      limit,
    };
  },

  get: async (id: string): Promise<UserResponse> => {
    await delay(200);
    const user = mockUsers.find((u) => u.id === id);
    if (!user) throw new Error('User not found');
    return user;
  },

  create: async (dto: CreateUserDto): Promise<{ id: string }> => {
    await delay(400);
    const id = String(mockUsers.length + 1);
    mockUsers.push({
      id,
      username: dto.username,
      email: dto.email ?? null,
      emailVerified: false,
      phone: dto.phone ?? null,
      phoneVerified: false,
      status: dto.status ?? 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { id };
  },

  update: async (id: string, dto: UpdateUserDto): Promise<void> => {
    await delay(400);
    const index = mockUsers.findIndex((u) => u.id === id);
    if (index === -1) throw new Error('User not found');
    const prev = mockUsers[index]!;
    mockUsers[index] = {
      ...prev,
      ...dto,
      id: prev.id,
      updatedAt: new Date(),
    } as UserResponse;
  },

  delete: async (id: string): Promise<void> => {
    await delay(300);
    const index = mockUsers.findIndex((u) => u.id === id);
    if (index === -1) throw new Error('User not found');
    mockUsers.splice(index, 1);
  },

  // Role assignment endpoints
  getRoles: async (userId: string): Promise<RoleResponse[]> => {
    await delay(200);
    const roleIds = mockUserRoles.get(userId) ?? [];
    return mockRoles.filter((r) => roleIds.includes(r.id));
  },

  addRole: async (userId: string, roleId: string): Promise<void> => {
    await delay(300);
    const existing = mockUserRoles.get(userId) ?? [];
    if (!existing.includes(roleId)) {
      mockUserRoles.set(userId, [...existing, roleId]);
    }
  },

  removeRole: async (userId: string, roleId: string): Promise<void> => {
    await delay(300);
    const existing = mockUserRoles.get(userId) ?? [];
    mockUserRoles.set(
      userId,
      existing.filter((id) => id !== roleId),
    );
  },
};

// ============================================================================
// EXPORT ALL MOCK APIs
// ============================================================================

export const mockApi = {
  auth: mockAuthApi,
  tenants: mockTenantApi,
  clients: mockClientApi,
  roles: mockRoleApi,
  groups: mockGroupApi,
  users: mockUserApi,
};
