import type { PaginatedResult } from '@/types/pagination.types';
import type {
  TenantResponse,
  CreateTenantDto,
  UpdateTenantDto,
} from '@/types/tenant.types';
import type {
  ClientAuthPolicyResponse,
  ClientResponse,
  CreateClientDto,
  UpdateClientAuthPolicyDto,
  UpdateClientDto,
} from '@/types/client.types';
import type {
  TenantPolicyResponse,
  UpdateTenantPoliciesDto,
} from '@/types/policy.types';
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
  UserConsentResponse,
  CreateUserDto,
  UpdateUserDto,
} from '@/types/user.types';
import type {
  IdentityLinkResponse,
  ChangePasswordDto,
  LoginDto,
  LoginResponse,
  ProfileResponse,
  TotpConfirmationResponse,
  TotpEnrollmentResponse,
} from '@/types/auth.types';
import type {
  AuditLogFilters,
  AuditLogResponse,
} from '@/types/audit-log.types';
import type { IdentityProviderResponse } from '@/types/identity-provider.types';

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

const defaultTenantPolicies: TenantPolicyResponse = {
  password: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSymbol: true,
    preventReuseCount: 5,
    expiresInDays: 90,
    lockoutFailureThreshold: 5,
    lockoutDurationSec: 900,
  },
  mfa: {
    required: false,
    adminRequired: true,
  },
  allowedIdp: {
    providerKeys: null,
  },
  session: {
    maxAgeSec: 28800,
    requireAuthTime: false,
    reauthenticationIntervalSec: null,
  },
  refreshToken: {
    ttlSec: 1209600,
    rotationEnabled: true,
    reuseAction: 'revoke_grant',
  },
  signup: {
    mode: 'invite',
    allowedEmailDomains: [],
  },
};

let mockTenantPolicies: TenantPolicyResponse = structuredClone(
  defaultTenantPolicies,
);

const mockClientAuthPolicies: Record<string, ClientAuthPolicyResponse> = {
  '1': {
    clientRefId: '1',
    allowedAuthMethods: ['password'],
    defaultAcr: 'urn:auth:pwd',
    mfaRequired: false,
    allowedMfaMethods: ['totp'],
    maxSessionDurationSec: null,
    consentRequired: true,
    requireAuthTime: false,
    allowedIdpProviderKeys: null,
    reauthenticationIntervalSec: null,
    refreshTokenRotationEnabled: true,
    refreshTokenReuseAction: 'revoke_grant',
    effective: {
      mfaRequired: false,
      allowedIdpProviderKeys: null,
      maxSessionDurationSec: 28800,
      requireAuthTime: false,
      reauthenticationIntervalSec: null,
      refreshTokenTtlSec: 1209600,
    },
  },
};

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
    mfaEnabled: true,
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
    mfaEnabled: false,
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
    mfaEnabled: false,
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
    mfaEnabled: false,
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
    mfaEnabled: false,
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

const mockUserConsents = new Map<string, UserConsentResponse[]>([
  [
    '1',
    [
      {
        id: 'consent-1',
        userId: '1',
        clientRefId: '1',
        clientId: 'web-app',
        clientName: 'Web Application',
        grantedScopes: 'openid profile email',
        grantedAt: new Date('2024-03-01T09:00:00Z'),
        revokedAt: null,
        status: 'ACTIVE',
      },
      {
        id: 'consent-2',
        userId: '1',
        clientRefId: '2',
        clientId: 'mobile-app',
        clientName: 'Mobile Application',
        grantedScopes: 'openid profile email offline_access',
        grantedAt: new Date('2024-02-10T09:00:00Z'),
        revokedAt: new Date('2024-02-20T09:00:00Z'),
        status: 'REVOKED',
      },
    ],
  ],
  [
    '2',
    [
      {
        id: 'consent-3',
        userId: '2',
        clientRefId: '1',
        clientId: 'web-app',
        clientName: 'Web Application',
        grantedScopes: 'openid profile',
        grantedAt: new Date('2024-03-04T12:00:00Z'),
        revokedAt: null,
        status: 'ACTIVE',
      },
    ],
  ],
]);

const mockAuditLogs: AuditLogResponse[] = [
  {
    id: 'audit-1',
    category: 'AUTH',
    severity: 'INFO',
    action: 'LOGIN',
    userId: '1',
    clientId: '1',
    resourceType: 'session',
    resourceId: 'session-1',
    success: true,
    reason: null,
    userAgent: 'Mozilla/5.0',
    correlationId: 'req-1001',
    metadata: { method: 'password' },
    occurredAt: new Date('2024-03-01T09:00:00Z'),
  },
  {
    id: 'audit-2',
    category: 'SECURITY',
    severity: 'WARN',
    action: 'ACCESS_DENIED',
    userId: null,
    clientId: '3',
    resourceType: 'client',
    resourceId: '3',
    success: false,
    reason: 'invalid_client',
    userAgent: null,
    correlationId: 'req-1002',
    metadata: { endpoint: 'token' },
    occurredAt: new Date('2024-03-02T11:00:00Z'),
  },
];

function paginate<T>(
  items: T[],
  params: { page?: number; limit?: number },
): PaginatedResult<T> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;
  const start = (page - 1) * limit;

  return {
    items: items.slice(start, start + limit),
    total: items.length,
    page,
    limit,
  };
}

const mockProfileByTenant = new Map<string, ProfileResponse>([
  [
    'default',
    {
      id: '1',
      username: 'admin',
      email: 'admin@example.com',
      emailVerified: false,
      phone: '+821012345678',
      phoneVerified: false,
      status: 'active',
      mfaEnabled: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ],
]);

const mockIdentityLinksByTenant = new Map<string, IdentityLinkResponse[]>([
  [
    'default',
    [
      {
        id: 'identity-link-1',
        provider: 'google',
        email: 'admin@example.com',
        linkedAt: new Date('2024-01-15'),
      },
      {
        id: 'identity-link-2',
        provider: 'saml-corporate',
        email: 'admin@corp.example.com',
        linkedAt: new Date('2024-02-20'),
      },
    ],
  ],
]);

const mockIdentityProviders: IdentityProviderResponse[] = [
  {
    id: 'mock-idp-google',
    provider: 'google',
    protocol: 'oauth2',
    displayName: 'Google',
    clientId: 'google-client',
    clientSecretSet: true,
    redirectUri: 'http://localhost:3000/auth/identity-links/google/callback',
    enabled: true,
    oauthConfig: null,
    samlConfig: null,
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-01').toISOString(),
  },
  {
    id: 'mock-idp-github',
    provider: 'github',
    protocol: 'oauth2',
    displayName: 'GitHub',
    clientId: 'github-client',
    clientSecretSet: true,
    redirectUri: 'http://localhost:3000/auth/identity-links/github/callback',
    enabled: true,
    oauthConfig: {
      authorizationUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      userinfoUrl: 'https://api.github.com/user',
      scopes: ['read:user', 'user:email'],
      subField: 'id',
      emailField: 'email',
    },
    samlConfig: null,
    createdAt: new Date('2024-01-02').toISOString(),
    updatedAt: new Date('2024-01-02').toISOString(),
  },
];

function getMockProfile(tenantCode: string): ProfileResponse {
  const profile =
    mockProfileByTenant.get(tenantCode) ?? mockProfileByTenant.get('default');
  if (!profile) throw new Error('Profile not found');
  return profile;
}

// ============================================================================
// AUTHENTICATION API
// ============================================================================

export const mockAuthApi = {
  login: async (dto: LoginDto): Promise<LoginResponse> => {
    await delay(500);

    // Mock credentials: admin/admin
    if (dto.username === 'admin' && dto.password === 'admin') {
      return {
        username: dto.username,
        passwordChangeRequired: false,
      };
    }

    throw new Error('Invalid credentials');
  },

  getSession: async (): Promise<LoginResponse> => {
    await delay(100);
    return { username: 'admin', passwordChangeRequired: false };
  },

  logout: async (): Promise<void> => {
    await delay(200);
    // Nothing to do for mock
  },

  changeAdminPassword: async (_dto: ChangePasswordDto): Promise<void> => {
    await delay(200);
  },

  getProfile: async (tenantCode: string): Promise<ProfileResponse> => {
    await delay(200);
    return { ...getMockProfile(tenantCode) };
  },

  requestEmailVerification: async (tenantCode: string): Promise<void> => {
    void tenantCode;
    await delay(200);
  },

  verifyEmail: async (tenantCode: string, token: string): Promise<void> => {
    await delay(200);
    if (!token.trim()) throw new Error('Verification token is required');
    const profile = getMockProfile(tenantCode);
    profile.emailVerified = true;
    profile.updatedAt = new Date();
  },

  requestPhoneVerification: async (tenantCode: string): Promise<void> => {
    void tenantCode;
    await delay(200);
  },

  verifyPhone: async (tenantCode: string, token: string): Promise<void> => {
    await delay(200);
    if (!token.trim()) throw new Error('Verification token is required');
    const profile = getMockProfile(tenantCode);
    profile.phoneVerified = true;
    profile.updatedAt = new Date();
  },

  beginTotpEnrollment: async (
    tenantCode: string,
  ): Promise<TotpEnrollmentResponse> => {
    void tenantCode;
    await delay(200);
    return {
      secret: 'JBSWY3DPEHPK3PXP',
      otpauthUrl:
        'otpauth://totp/Auth%20Server:admin?secret=JBSWY3DPEHPK3PXP&issuer=Auth%20Server',
    };
  },

  confirmTotpEnrollment: async (
    tenantCode: string,
    code: string,
  ): Promise<TotpConfirmationResponse> => {
    await delay(200);
    if (!/^\d{6}$/.test(code)) throw new Error('TOTP code must be 6 digits');
    const profile = getMockProfile(tenantCode);
    profile.mfaEnabled = true;
    profile.updatedAt = new Date();
    return {
      recoveryCodes: ['RC-1234-5678', 'RC-2345-6789', 'RC-3456-7890'],
    };
  },

  getRecoveryCodeStatus: async (
    tenantCode: string,
  ): Promise<{
    remaining: number;
    total: number;
    used: number;
    low: boolean;
  }> => {
    void tenantCode;
    await delay(150);
    return { remaining: 3, total: 10, used: 7, low: false };
  },

  rotateRecoveryCodes: async (
    tenantCode: string,
  ): Promise<TotpConfirmationResponse> => {
    void tenantCode;
    await delay(200);
    return {
      recoveryCodes: ['RC-4567-8901', 'RC-5678-9012', 'RC-6789-0123'],
    };
  },

  disableTotp: async (tenantCode: string): Promise<void> => {
    await delay(200);
    const profile = getMockProfile(tenantCode);
    profile.mfaEnabled = false;
    profile.updatedAt = new Date();
  },

  updateMfaPreference: async (
    tenantCode: string,
    enabled: boolean,
  ): Promise<void> => {
    await delay(200);
    const profile = getMockProfile(tenantCode);
    profile.mfaEnabled = enabled;
    profile.updatedAt = new Date();
  },

  startIdentityLink: async (
    tenantCode: string,
    provider: string,
    returnTo: string,
  ): Promise<{ authorizationUrl: string }> => {
    await delay(200);
    const links =
      mockIdentityLinksByTenant.get(tenantCode) ??
      mockIdentityLinksByTenant.get('default') ??
      [];
    if (!links.some((link) => link.provider === provider)) {
      links.push({
        id: `identity-link-${provider}`,
        provider,
        email: `${provider}-user@example.com`,
        linkedAt: new Date(),
      });
    }
    const redirectTo =
      returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
        ? returnTo
        : '/admin/security';
    return {
      authorizationUrl: `${redirectTo}?identityLinked=${encodeURIComponent(provider)}`,
    };
  },

  getIdentityLinks: async (
    tenantCode: string,
  ): Promise<IdentityLinkResponse[]> => {
    await delay(200);
    return [
      ...(mockIdentityLinksByTenant.get(tenantCode) ??
        mockIdentityLinksByTenant.get('default') ??
        []),
    ];
  },

  unlinkIdentity: async (
    tenantCode: string,
    identityId: string,
  ): Promise<void> => {
    await delay(200);
    const links =
      mockIdentityLinksByTenant.get(tenantCode) ??
      mockIdentityLinksByTenant.get('default') ??
      [];
    const index = links.findIndex((link) => link.id === identityId);
    if (index === -1) throw new Error('Identity link not found');
    links.splice(index, 1);
  },
};

export const mockIdentityProviderApi = {
  list: async (params: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<IdentityProviderResponse>> => {
    await delay(200);
    return paginate(mockIdentityProviders, params);
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

  getAuthPolicy: async (id: string): Promise<ClientAuthPolicyResponse> => {
    await delay(200);
    return (
      mockClientAuthPolicies[id] ?? {
        ...mockClientAuthPolicies['1']!,
        clientRefId: id,
      }
    );
  },

  updateAuthPolicy: async (
    id: string,
    dto: UpdateClientAuthPolicyDto,
  ): Promise<void> => {
    await delay(300);
    const current = mockClientAuthPolicies[id] ?? {
      ...mockClientAuthPolicies['1']!,
      clientRefId: id,
    };
    mockClientAuthPolicies[id] = {
      ...current,
      ...dto,
      effective: {
        ...current.effective,
        mfaRequired:
          mockTenantPolicies.mfa.required || Boolean(dto.mfaRequired),
        allowedIdpProviderKeys:
          dto.allowedIdpProviderKeys ??
          current.allowedIdpProviderKeys ??
          mockTenantPolicies.allowedIdp.providerKeys,
        maxSessionDurationSec:
          dto.maxSessionDurationSec ??
          current.maxSessionDurationSec ??
          mockTenantPolicies.session.maxAgeSec,
        requireAuthTime:
          mockTenantPolicies.session.requireAuthTime ||
          Boolean(dto.requireAuthTime ?? current.requireAuthTime),
        reauthenticationIntervalSec:
          dto.reauthenticationIntervalSec ??
          current.reauthenticationIntervalSec ??
          mockTenantPolicies.session.reauthenticationIntervalSec,
      },
    };
  },
};

export const mockPolicyApi = {
  getTenantPolicies: async (): Promise<TenantPolicyResponse> => {
    await delay(200);
    return mockTenantPolicies;
  },

  updateTenantPolicies: async (dto: UpdateTenantPoliciesDto): Promise<void> => {
    await delay(300);
    mockTenantPolicies = {
      password: { ...mockTenantPolicies.password, ...(dto.password ?? {}) },
      mfa: { ...mockTenantPolicies.mfa, ...(dto.mfa ?? {}) },
      allowedIdp: {
        ...mockTenantPolicies.allowedIdp,
        ...(dto.allowedIdp ?? {}),
      },
      session: { ...mockTenantPolicies.session, ...(dto.session ?? {}) },
      refreshToken: {
        ...mockTenantPolicies.refreshToken,
        ...(dto.refreshToken ?? {}),
      },
      signup: { ...mockTenantPolicies.signup, ...(dto.signup ?? {}) },
    };
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
      mfaEnabled: false,
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

  getConsents: async (
    userId: string,
    params: { page?: number; limit?: number },
  ): Promise<PaginatedResult<UserConsentResponse>> => {
    await delay(200);
    const items = (mockUserConsents.get(userId) ?? []).filter(
      (consent) => consent.status === 'ACTIVE',
    );
    return paginate(items, params);
  },

  getConsentHistory: async (
    userId: string,
    params: { page?: number; limit?: number },
  ): Promise<PaginatedResult<UserConsentResponse>> => {
    await delay(200);
    return paginate(mockUserConsents.get(userId) ?? [], params);
  },
};

export const mockAuditLogApi = {
  list: async (
    params: AuditLogFilters,
  ): Promise<PaginatedResult<AuditLogResponse>> => {
    await delay(200);
    const from = params.from ? new Date(params.from) : null;
    const to = params.to ? new Date(params.to) : null;
    const items = mockAuditLogs.filter((log) => {
      const occurredAt =
        log.occurredAt instanceof Date
          ? log.occurredAt
          : new Date(log.occurredAt);
      return (
        (!from || occurredAt >= from) &&
        (!to || occurredAt <= to) &&
        (!params.userId || log.userId === params.userId) &&
        (!params.clientId || log.clientId === params.clientId) &&
        (!params.category || log.category === params.category) &&
        (!params.action || log.action === params.action) &&
        (!params.severity || log.severity === params.severity) &&
        (!params.correlationId || log.correlationId === params.correlationId)
      );
    });
    return paginate(items, params);
  },
};

// ============================================================================
// EXPORT ALL MOCK APIs
// ============================================================================

export const mockApi = {
  auth: mockAuthApi,
  tenants: mockTenantApi,
  clients: mockClientApi,
  policies: mockPolicyApi,
  roles: mockRoleApi,
  groups: mockGroupApi,
  users: mockUserApi,
  auditLogs: mockAuditLogApi,
  identityProviders: mockIdentityProviderApi,
};
