import { Collection } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/core';
import { TenantOrmEntity } from '@infrastructure/mikro-orm/entities/tenant';
import { ClientOrmEntity } from '@infrastructure/mikro-orm/entities/client';
import { GroupOrmEntity } from '@infrastructure/mikro-orm/entities/group';
import { RoleOrmEntity } from '@infrastructure/mikro-orm/entities/role';
import { PermissionOrmEntity } from '@infrastructure/mikro-orm/entities/permission';
import { UserOrmEntity } from '@infrastructure/mikro-orm/entities/user';
import { UserCredentialOrmEntity } from '@infrastructure/mikro-orm/entities/user-credential';
import { UserIdentityOrmEntity } from '@infrastructure/mikro-orm/entities/user-identity';
import { IdentityProviderOrmEntity } from '@infrastructure/mikro-orm/entities/indentity-provider';
import { ConsentOrmEntity } from '@infrastructure/mikro-orm/entities/consent';
import { ClientAuthPolicyOrmEntity } from '@infrastructure/mikro-orm/entities/client-auth-policy';
import { TenantConfigOrmEntity } from '@infrastructure/mikro-orm/entities/tenant-config';
import { JwksKeyOrmEntity } from '@infrastructure/mikro-orm/entities/jwks-key';
import { EventOrmEntity } from '@infrastructure/mikro-orm/entities/event';
import { UserRoleOrmEntity } from '@infrastructure/mikro-orm/entities/user-role';
import { GroupRoleOrmEntity } from '@infrastructure/mikro-orm/entities/group-role';
import { RolePermissionOrmEntity } from '@infrastructure/mikro-orm/entities/role-permission';
import { RoleInheritOrmEntity } from '@infrastructure/mikro-orm/entities/role-inherit';
import { TenantModel } from '@domain/models/tenant';
import { ClientModel } from '@domain/models/client';
import { GroupModel } from '@domain/models/group';
import { RoleModel } from '@domain/models/role';
import { PermissionModel } from '@domain/models/permission';
import { UserModel } from '@domain/models/user';
import { UserCredentialModel } from '@domain/models/user-credential';
import { UserIdentityModel } from '@domain/models/user-identity';
import { IdentityProviderModel } from '@domain/models/identity-provider';
import { ConsentModel } from '@domain/models/consent';
import { ClientAuthPolicyModel } from '@domain/models/client-auth-policy';
import { TenantConfigModel } from '@domain/models/tenant-config';
import { JwksKeyModel } from '@domain/models/jwks-key';
import { EventModel } from '@domain/models/event';

type Constructor<T extends object> = new () => T;

type LoadedRef<T extends { id: string }> = T & {
  unwrap(): T;
  isInitialized(): boolean;
};

export type EntityManagerMock = {
  findOne: jest.Mock;
  findOneOrFail: jest.Mock;
  find: jest.Mock;
  findAndCount: jest.Mock;
  persist: jest.Mock;
  remove: jest.Mock;
  flush: jest.Mock;
  count: jest.Mock;
  nativeUpdate: jest.Mock;
  transactional: jest.Mock;
  getReference: jest.Mock;
  create: jest.Mock;
};

export function asLoadedRef<T extends { id: string }>(entity: T): LoadedRef<T> {
  return Object.assign(entity, {
    unwrap: () => entity,
    isInitialized: () => true,
  });
}

function withTimestamps<T extends { createdAt?: Date; updatedAt?: Date }>(
  entity: T,
  overrides: Partial<T>,
): T {
  return Object.assign(entity, {
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    ...overrides,
  });
}

function createEntity<T extends object>(EntityClass: Constructor<T>, data: any): T {
  return Object.assign(new EntityClass(), data) as T;
}

export function createEntityManagerMock(): EntityManagerMock {
  const flush = jest.fn().mockResolvedValue(undefined);
  const em = {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    flush,
    count: jest.fn().mockResolvedValue(0),
    nativeUpdate: jest.fn().mockResolvedValue(0),
    transactional: jest.fn(),
    getReference: jest.fn(
      <T extends object>(EntityClass: Constructor<T>, id: string): T =>
        asLoadedRef(createEntity(EntityClass, { id }) as T & { id: string }) as T,
    ),
    create: jest.fn(
      <T extends object>(EntityClass: Constructor<T>, data: Partial<T>): T =>
        createEntity(EntityClass, data),
    ),
    persist: jest.fn(() => ({ flush })),
    remove: jest.fn(() => ({ flush })),
  } as unknown as EntityManagerMock;

  em.transactional.mockImplementation(
    async (callback: (inner: EntityManager) => unknown) =>
      callback(em as unknown as EntityManager),
  );

  return em;
}

export function createTransactionalEntityManagers(): {
  em: EntityManagerMock;
  txEm: EntityManagerMock;
} {
  const em = createEntityManagerMock();
  const txEm = createEntityManagerMock();

  em.transactional.mockImplementation(
    async (callback: (inner: EntityManager) => unknown) =>
      callback(txEm as unknown as EntityManager),
  );

  return { em, txEm };
}

export function createTenantEntity(
  overrides: any = {},
): TenantOrmEntity {
  return withTimestamps(
    createEntity(TenantOrmEntity, {
      id: 'tenant-1',
      code: 'acme',
      name: 'Acme',
    }),
    overrides,
  );
}

export function createClientEntity(
  overrides: any = {},
): ClientOrmEntity {
  const tenant = overrides.tenant ?? asLoadedRef(createTenantEntity());

  return withTimestamps(
    createEntity(ClientOrmEntity, {
      id: 'client-ref-1',
      tenant,
      clientId: 'client-1',
      secretEnc: null,
      name: 'Example Client',
      type: 'public',
      enabled: true,
      redirectUris: ['https://app.example.com/callback'],
      grantTypes: ['authorization_code'],
      responseTypes: ['code'],
      tokenEndpointAuthMethod: 'none',
      scope: 'openid profile',
      postLogoutRedirectUris: ['https://app.example.com/logout'],
      applicationType: 'web',
      backchannelLogoutUri: null,
      frontchannelLogoutUri: null,
      allowedResources: ['https://api.example.com'],
      accessTokenTtlSec: 3600,
      refreshTokenTtlSec: 86400,
      skipConsent: false,
    }),
    overrides,
  );
}

export function createGroupEntity(
  overrides: any = {},
): GroupOrmEntity {
  return withTimestamps(
    createEntity(GroupOrmEntity, {
      id: 'group-1',
      tenant: overrides.tenant ?? asLoadedRef(createTenantEntity()),
      code: 'ops',
      name: 'Operations',
      parent: overrides.parent ?? null,
    }),
    overrides,
  );
}

export function createRoleEntity(
  overrides: any = {},
): RoleOrmEntity {
  return withTimestamps(
    createEntity(RoleOrmEntity, {
      id: 'role-1',
      tenant: overrides.tenant ?? asLoadedRef(createTenantEntity()),
      code: 'admin',
      name: 'Administrator',
      description: '관리자 역할',
    }),
    overrides,
  );
}

export function createPermissionEntity(
  overrides: any = {},
): PermissionOrmEntity {
  return withTimestamps(
    createEntity(PermissionOrmEntity, {
      id: 'permission-1',
      tenant: overrides.tenant ?? asLoadedRef(createTenantEntity()),
      code: 'tenant.read',
      resource: 'tenant',
      action: 'read',
      description: '테넌트 조회',
    }),
    overrides,
  );
}

export function createUserCredentialEntity(
  overrides: any = {},
): UserCredentialOrmEntity {
  return withTimestamps(
    createEntity(UserCredentialOrmEntity, {
      id: 'credential-1',
      user: overrides.user ?? asLoadedRef(createUserEntity()),
      type: 'password',
      secretHash: 'hashed-secret',
      hashAlg: 'argon2id',
      hashParams: { memoryCost: 65536 },
      hashVersion: 1,
      enabled: true,
      expiresAt: undefined,
    }),
    overrides,
  );
}

export function createUserEntity(
  overrides: any = {},
): UserOrmEntity {
  const entity = withTimestamps(
    createEntity(UserOrmEntity, {
      id: 'user-1',
      tenant: overrides.tenant ?? asLoadedRef(createTenantEntity()),
      username: 'alice',
      email: 'alice@example.com',
      emailVerified: true,
      phone: '01012341234',
      phoneVerified: true,
      status: 'ACTIVE',
    }),
    overrides,
  );

  const credentials = createCollection(entity, []);
  Object.assign(entity, { credentials });
  return entity;
}

export function attachCredentials(
  user: UserOrmEntity,
  credentials: UserCredentialOrmEntity[],
): void {
  Object.assign(user, { credentials: createCollection(user, credentials) });
}

export function createIdentityProviderEntity(
  overrides: any = {},
): IdentityProviderOrmEntity {
  return withTimestamps(
    createEntity(IdentityProviderOrmEntity, {
      id: 'idp-1',
      tenant: overrides.tenant ?? asLoadedRef(createTenantEntity()),
      provider: 'google',
      displayName: 'Google',
      clientId: 'google-client',
      clientSecret: 'secret',
      redirectUri: 'https://auth.example.com/callback',
      enabled: true,
    }),
    overrides,
  );
}

export function createUserIdentityEntity(
  overrides: any = {},
): UserIdentityOrmEntity {
  return withTimestamps(
    createEntity(UserIdentityOrmEntity, {
      id: 'user-identity-1',
      tenant: overrides.tenant ?? asLoadedRef(createTenantEntity()),
      user: overrides.user ?? asLoadedRef(createUserEntity()),
      provider: 'google',
      providerSub: 'provider-sub-1',
      email: 'alice@example.com',
      profileJson: { locale: 'ko-KR' },
      linkedAt: new Date('2025-01-02T00:00:00.000Z'),
    }),
    overrides,
  );
}

export function createConsentEntity(
  overrides: any = {},
): ConsentOrmEntity {
  const client = overrides.client ?? asLoadedRef(createClientEntity());

  return createEntity(ConsentOrmEntity, {
    id: 'consent-1',
    tenant: overrides.tenant ?? asLoadedRef(createTenantEntity()),
    user: overrides.user ?? asLoadedRef(createUserEntity()),
    client,
    grantedScopes: 'openid profile',
    grantedAt: new Date('2025-01-03T00:00:00.000Z'),
    revokedAt: null,
    ...overrides,
  });
}

export function createClientAuthPolicyEntity(
  overrides: any = {},
): ClientAuthPolicyOrmEntity {
  return withTimestamps(
    createEntity(ClientAuthPolicyOrmEntity, {
      id: 'client-auth-policy-1',
      tenant: overrides.tenant ?? asLoadedRef(createTenantEntity()),
      client: overrides.client ?? asLoadedRef(createClientEntity()),
      allowedAuthMethods: ['password'],
      defaultAcr: 'urn:auth:pwd',
      mfaRequired: false,
      allowedMfaMethods: ['totp'],
      maxSessionDurationSec: null,
      consentRequired: true,
      requireAuthTime: false,
    }),
    overrides,
  );
}

export function createTenantConfigEntity(
  overrides: any = {},
): TenantConfigOrmEntity {
  return createEntity(TenantConfigOrmEntity, {
    tenant: overrides.tenant ?? createTenantEntity(),
    signupPolicy: 'open',
    requirePhoneVerify: false,
    brandName: 'Acme',
    accessTokenTtlSec: 3600,
    refreshTokenTtlSec: 86400,
    extra: { policies: { allowSignup: true } },
    ...overrides,
  });
}

export function createJwksKeyEntity(
  overrides: any = {},
): JwksKeyOrmEntity {
  return createEntity(JwksKeyOrmEntity, {
    kid: 'kid-1',
    tenant: overrides.tenant ?? asLoadedRef(createTenantEntity()),
    algorithm: 'RS256',
    publicKey: 'public-key',
    privateKeyEnc: 'private-key',
    status: 'active',
    rotatedAt: null,
    expiresAt: null,
    createdAt: new Date('2025-01-04T00:00:00.000Z'),
    ...overrides,
  });
}

export function createEventEntity(
  overrides: any = {},
): EventOrmEntity {
  return createEntity(EventOrmEntity, {
    id: 'event-1',
    tenant: overrides.tenant ?? createTenantEntity(),
    user: overrides.user ?? createUserEntity(),
    client: overrides.client ?? createClientEntity(),
    category: 'AUTH',
    severity: 'INFO',
    action: 'LOGIN',
    resourceType: 'user',
    resourceId: 'user-1',
    success: true,
    reason: null,
    ip: Buffer.from('127.0.0.1'),
    userAgent: 'jest',
    metadata: { source: 'test' },
    occurredAt: new Date('2025-01-05T00:00:00.000Z'),
    ...overrides,
  });
}

export function createUserRoleEntity(
  overrides: any = {},
): UserRoleOrmEntity {
  return createEntity(UserRoleOrmEntity, {
    user: overrides.user ?? asLoadedRef(createUserEntity()),
    role: overrides.role ?? asLoadedRef(createRoleEntity()),
    client: overrides.client ?? null,
    ...overrides,
  });
}

export function createGroupRoleEntity(
  overrides: any = {},
): GroupRoleOrmEntity {
  return createEntity(GroupRoleOrmEntity, {
    group: overrides.group ?? asLoadedRef(createGroupEntity()),
    role: overrides.role ?? asLoadedRef(createRoleEntity()),
    client: overrides.client ?? null,
    ...overrides,
  });
}

export function createRolePermissionEntity(
  overrides: any = {},
): RolePermissionOrmEntity {
  return createEntity(RolePermissionOrmEntity, {
    role: overrides.role ?? asLoadedRef(createRoleEntity()),
    permission:
      overrides.permission ?? asLoadedRef(createPermissionEntity()),
    ...overrides,
  });
}

export function createRoleInheritEntity(
  overrides: any = {},
): RoleInheritOrmEntity {
  return createEntity(RoleInheritOrmEntity, {
    parent: overrides.parent ?? asLoadedRef(createRoleEntity({ id: 'role-parent' })),
    child: overrides.child ?? asLoadedRef(createRoleEntity({ id: 'role-child' })),
    ...overrides,
  });
}

function createCollection<T extends object>(
  owner: object,
  items: T[],
): Collection<T> {
  const collection = new Collection<T>(owner as T);
  Object.assign(collection, {
    getItems: () => items,
  });
  return collection;
}

export function createTenantModel(
  overrides: Partial<ConstructorParameters<typeof TenantModel>[0]> = {},
  id?: string,
): TenantModel {
  return new TenantModel(
    {
      code: 'acme',
      name: 'Acme',
      ...overrides,
    },
    id,
  );
}

export function createClientModel(
  overrides: Partial<ConstructorParameters<typeof ClientModel>[0]> = {},
  id?: string,
): ClientModel {
  return new ClientModel(
    {
      tenantId: 'tenant-1',
      clientId: 'client-1',
      secretEnc: null,
      name: 'Example Client',
      type: 'public',
      enabled: true,
      redirectUris: ['https://app.example.com/callback'],
      grantTypes: ['authorization_code'],
      responseTypes: ['code'],
      tokenEndpointAuthMethod: 'none',
      scope: 'openid profile',
      postLogoutRedirectUris: ['https://app.example.com/logout'],
      applicationType: 'web',
      backchannelLogoutUri: null,
      frontchannelLogoutUri: null,
      accessTokenTtlSec: 3600,
      refreshTokenTtlSec: 86400,
      allowedResources: ['https://api.example.com'],
      skipConsent: false,
      ...overrides,
    },
    id,
  );
}

export function createGroupModel(
  overrides: Partial<ConstructorParameters<typeof GroupModel>[0]> = {},
  id?: string,
): GroupModel {
  return new GroupModel(
    {
      tenantId: 'tenant-1',
      code: 'ops',
      name: 'Operations',
      parentId: null,
      ...overrides,
    },
    id,
  );
}

export function createRoleModel(
  overrides: Partial<ConstructorParameters<typeof RoleModel>[0]> = {},
  id?: string,
): RoleModel {
  return new RoleModel(
    {
      tenantId: 'tenant-1',
      code: 'admin',
      name: 'Administrator',
      description: '관리자 역할',
      ...overrides,
    },
    id,
  );
}

export function createPermissionModel(
  overrides: Partial<ConstructorParameters<typeof PermissionModel>[0]> = {},
  id?: string,
): PermissionModel {
  return new PermissionModel(
    {
      tenantId: 'tenant-1',
      code: 'tenant.read',
      resource: 'tenant',
      action: 'read',
      description: '테넌트 조회',
      ...overrides,
    },
    id,
  );
}

export function createUserCredentialModel(
  overrides: Partial<Parameters<typeof UserCredentialModel.of>[0]> = {},
  id?: string,
): UserCredentialModel {
  return UserCredentialModel.of(
    {
      type: 'password',
      secretHash: 'hashed-secret',
      hashAlg: 'argon2id',
      hashParams: { memoryCost: 65536 },
      hashVersion: 1,
      enabled: true,
      expiresAt: null,
      ...overrides,
    },
    id,
  );
}

export function createUserModel(
  overrides: Partial<Parameters<typeof UserModel.of>[0]> = {},
): UserModel {
  return UserModel.of({
    id: 'user-1',
    tenantId: 'tenant-1',
    username: 'alice',
    email: 'alice@example.com',
    emailVerified: true,
    phone: '01012341234',
    phoneVerified: true,
    status: 'ACTIVE',
    ...overrides,
  });
}

export function createIdentityProviderModel(
  overrides: Partial<ConstructorParameters<typeof IdentityProviderModel>[0]> = {},
  id?: string,
): IdentityProviderModel {
  return new IdentityProviderModel(
    {
      tenantId: 'tenant-1',
      provider: 'google',
      displayName: 'Google',
      clientId: 'google-client',
      clientSecret: 'secret',
      redirectUri: 'https://auth.example.com/callback',
      enabled: true,
      ...overrides,
    },
    id,
  );
}

export function createUserIdentityModel(
  overrides: Partial<ConstructorParameters<typeof UserIdentityModel>[0]> = {},
  id?: string,
): UserIdentityModel {
  return new UserIdentityModel(
    {
      tenantId: 'tenant-1',
      userId: 'user-1',
      provider: 'google',
      providerSub: 'provider-sub-1',
      email: 'alice@example.com',
      profileJson: { locale: 'ko-KR' },
      linkedAt: new Date('2025-01-02T00:00:00.000Z'),
      ...overrides,
    },
    id,
  );
}

export function createConsentModel(
  overrides: Partial<ConstructorParameters<typeof ConsentModel>[0]> = {},
  id?: string,
): ConsentModel {
  return new ConsentModel(
    {
      tenantId: 'tenant-1',
      userId: 'user-1',
      clientRefId: 'client-ref-1',
      clientId: 'client-1',
      clientName: 'Example Client',
      grantedScopes: 'openid profile',
      grantedAt: new Date('2025-01-03T00:00:00.000Z'),
      revokedAt: null,
      ...overrides,
    },
    id,
  );
}

export function createClientAuthPolicyModel(
  overrides: Partial<ConstructorParameters<typeof ClientAuthPolicyModel>[0]> = {},
  id?: string,
): ClientAuthPolicyModel {
  return new ClientAuthPolicyModel(
    {
      tenantId: 'tenant-1',
      clientRefId: 'client-ref-1',
      allowedAuthMethods: ['password'],
      defaultAcr: 'urn:auth:pwd',
      mfaRequired: false,
      allowedMfaMethods: ['totp'],
      maxSessionDurationSec: null,
      consentRequired: true,
      requireAuthTime: false,
      ...overrides,
    },
    id,
  );
}

export function createTenantConfigModel(
  overrides: Partial<ConstructorParameters<typeof TenantConfigModel>[0]> = {},
): TenantConfigModel {
  return new TenantConfigModel({
    tenantId: 'tenant-1',
    signupPolicy: 'open',
    requirePhoneVerify: false,
    brandName: 'Acme',
    accessTokenTtlSec: 3600,
    refreshTokenTtlSec: 86400,
    extra: { policies: { allowSignup: true } },
    ...overrides,
  });
}

export function createJwksKeyModel(
  overrides: Partial<ConstructorParameters<typeof JwksKeyModel>[0]> = {},
): JwksKeyModel {
  return new JwksKeyModel({
    kid: 'kid-1',
    tenantId: 'tenant-1',
    algorithm: 'RS256',
    publicKey: 'public-key',
    privateKeyEnc: 'private-key',
    status: 'active',
    rotatedAt: null,
    expiresAt: null,
    createdAt: new Date('2025-01-04T00:00:00.000Z'),
    ...overrides,
  });
}

export function createEventModel(
  overrides: Partial<ConstructorParameters<typeof EventModel>[0]> = {},
  id?: string,
): EventModel {
  return new EventModel(
    {
      tenantId: 'tenant-1',
      userId: 'user-1',
      clientId: 'client-ref-1',
      category: 'AUTH',
      severity: 'INFO',
      action: 'LOGIN',
      resourceType: 'user',
      resourceId: 'user-1',
      success: true,
      reason: null,
      ip: Buffer.from('127.0.0.1'),
      userAgent: 'jest',
      metadata: { source: 'test' },
      occurredAt: new Date('2025-01-05T00:00:00.000Z'),
      ...overrides,
    },
    id,
  );
}
