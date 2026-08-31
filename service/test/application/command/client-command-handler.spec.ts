import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ClientCommandHandler } from '@application/commands/handlers/client-command.handler';
import type {
  ClientAuthPolicyRepository,
  ClientRepository,
} from '@domain/repositories';
import type { SymmetricCryptoPort } from '@application/ports/symmetric-crypto.port';
import type { GrantTypeRegistryPort } from '@application/ports/grant-type-registry.port';
import type { ScopeRegistryPort } from '@application/ports/scope-registry.port';
import { ClientModel } from '@domain/models/client';
import { ClientAuthPolicyModel } from '@domain/models/client-auth-policy';
import { UpdateClientDto as ApplicationUpdateClientDto } from '@application/dto';
import type { AuditRecorder } from '@application/services/audit-recorder';

function makeClient(id = 'client-1', tenantId = 'tenant-1'): ClientModel {
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
    backchannelLogoutUri: null,
    frontchannelLogoutUri: null,
    allowedResources: [],
    introspectionResources: [],
    skipConsent: false,
    accessTokenTtlSec: null,
    refreshTokenTtlSec: null,
  });
  c.setPersistence(id, new Date(), new Date());
  return c;
}

function makeServiceClient(): ClientModel {
  const client = new ClientModel({
    tenantId: 'tenant-1',
    clientId: 'orders-api',
    secretEnc: 'enc:service-secret',
    name: 'Orders API',
    type: 'service',
    enabled: true,
    redirectUris: [],
    grantTypes: ['client_credentials'],
    responseTypes: [],
    tokenEndpointAuthMethod: 'client_secret_basic',
    scope: 'orders:read',
    postLogoutRedirectUris: [],
    applicationType: 'web',
    backchannelLogoutUri: null,
    frontchannelLogoutUri: null,
    allowedResources: [],
    introspectionResources: ['https://api.example.com'],
    skipConsent: true,
    accessTokenTtlSec: null,
    refreshTokenTtlSec: null,
  });
  client.setPersistence('client-1', new Date(), new Date());
  return client;
}

function makeClientAuthPolicy(clientRefId = 'client-1'): ClientAuthPolicyModel {
  const policy = new ClientAuthPolicyModel({
    tenantId: 'tenant-1',
    clientRefId,
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
  });
  policy.setPersistence('policy-1', new Date(), new Date());
  return policy;
}

function createMockClientRepo(): jest.Mocked<ClientRepository> {
  return {
    findById: jest.fn().mockResolvedValue(makeClient()),
    findByClientId: jest.fn().mockResolvedValue(null),
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    save: jest.fn().mockImplementation(async (c: ClientModel) => {
      if (!c.id) c.setPersistence('new-id', new Date(), new Date());
      return c;
    }),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockClientAuthPolicyRepo(): jest.Mocked<ClientAuthPolicyRepository> {
  return {
    findByClientRefId: jest.fn().mockResolvedValue(makeClientAuthPolicy()),
    save: jest.fn().mockImplementation(async (p: ClientAuthPolicyModel) => p),
    deleteByClientRefId: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function createMockCrypto(): jest.Mocked<SymmetricCryptoPort> {
  return {
    encrypt: jest.fn().mockImplementation((v: string) => `enc:${v}`),
    decrypt: jest.fn().mockImplementation((v: string) => v.replace('enc:', '')),
  };
}

function createMockGrantTypeRegistry(): jest.Mocked<GrantTypeRegistryPort> {
  return {
    listSupportedGrantTypes: jest
      .fn()
      .mockResolvedValue([
        'authorization_code',
        'refresh_token',
        'client_credentials',
        'implicit',
      ]),
    listDefinitions: jest.fn(),
    validateClientGrantTypes: jest.fn().mockResolvedValue([]),
  };
}

function createMockScopeRegistry(): jest.Mocked<ScopeRegistryPort> {
  return {
    listSupportedScopes: jest
      .fn()
      .mockResolvedValue(['openid', 'profile', 'email', 'orders:read']),
    listDefinitions: jest.fn(),
    validateClientScopes: jest.fn().mockResolvedValue([]),
  };
}

function createMockAuditRecorder(): jest.Mocked<AuditRecorder> {
  return {
    recordAdminAction: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditRecorder>;
}

describe('ClientCommandHandler', () => {
  let handler: ClientCommandHandler;
  let clientRepo: jest.Mocked<ClientRepository>;
  let clientAuthPolicyRepo: jest.Mocked<ClientAuthPolicyRepository>;
  let crypto: jest.Mocked<SymmetricCryptoPort>;
  let grantTypeRegistry: jest.Mocked<GrantTypeRegistryPort>;
  let scopeRegistry: jest.Mocked<ScopeRegistryPort>;
  let auditRecorder: jest.Mocked<AuditRecorder>;

  beforeEach(() => {
    jest.clearAllMocks();
    clientRepo = createMockClientRepo();
    clientAuthPolicyRepo = createMockClientAuthPolicyRepo();
    crypto = createMockCrypto();
    grantTypeRegistry = createMockGrantTypeRegistry();
    scopeRegistry = createMockScopeRegistry();
    auditRecorder = createMockAuditRecorder();
    handler = new ClientCommandHandler(
      clientRepo,
      clientAuthPolicyRepo,
      crypto,
      grantTypeRegistry,
      scopeRegistry,
      auditRecorder,
    );
  });

  describe('createClient', () => {
    it('clientId 중복이 없으면 save를 호출하고 id를 반환한다', async () => {
      const result = await handler.createClient('tenant-1', {
        clientId: 'new-app',
        name: 'New App',
      });

      expect(clientRepo.findByClientId).toHaveBeenCalledWith(
        'tenant-1',
        'new-app',
      );
      expect(clientRepo.save).toHaveBeenCalledTimes(1);
      expect(clientAuthPolicyRepo.save).toHaveBeenCalledTimes(1);
      expect(grantTypeRegistry.validateClientGrantTypes).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        clientType: 'public',
        applicationType: 'web',
        tokenEndpointAuthMethod: 'none',
        grantTypes: ['authorization_code'],
      });
      expect(scopeRegistry.validateClientScopes).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        scopes: ['openid'],
      });
      expect(result.id).toBeDefined();
    });

    it('clientId가 이미 존재하면 ConflictException을 던진다', async () => {
      clientRepo.findByClientId.mockResolvedValue(makeClient());

      await expect(
        handler.createClient('tenant-1', { clientId: 'app-web', name: 'Dup' }),
      ).rejects.toThrow(ConflictException);

      expect(clientRepo.save).not.toHaveBeenCalled();
    });

    it('secret이 있으면 암호화하여 secretEnc로 저장한다', async () => {
      await handler.createClient('tenant-1', {
        clientId: 'conf-app',
        name: 'Confidential',
        secret: 'my-secret',
        type: 'confidential',
      });

      expect(crypto.encrypt).toHaveBeenCalledWith('my-secret');
      const saved = clientRepo.save.mock.calls[0][0] as ClientModel;
      expect(saved.secretEnc).toBe('enc:my-secret');
    });

    it('secret이 없으면 secretEnc가 null이다', async () => {
      await handler.createClient('tenant-1', {
        clientId: 'pub-app',
        name: 'Public',
      });

      expect(crypto.encrypt).not.toHaveBeenCalled();
      const saved = clientRepo.save.mock.calls[0][0] as ClientModel;
      expect(saved.secretEnc).toBeNull();
    });

    it('신규 필드가 기본값으로 설정된다', async () => {
      await handler.createClient('tenant-1', {
        clientId: 'basic',
        name: 'Basic',
      });

      const saved = clientRepo.save.mock.calls[0][0] as ClientModel;
      expect(saved.applicationType).toBe('web');
      expect(saved.backchannelLogoutUri).toBeNull();
      expect(saved.frontchannelLogoutUri).toBeNull();
      expect(saved.allowedResources).toEqual([]);
      expect(saved.accessTokenTtlSec).toBeNull();
      expect(saved.refreshTokenTtlSec).toBeNull();
    });

    it('신규 필드를 명시적으로 전달할 수 있다', async () => {
      await handler.createClient('tenant-1', {
        clientId: 'native-app',
        name: 'Native',
        applicationType: 'native',
        backchannelLogoutUri: 'https://app.example.com/bc-logout',
        frontchannelLogoutUri: 'https://app.example.com/fc-logout',
        allowedResources: ['https://api.example.com'],
        accessTokenTtlSec: 900,
        refreshTokenTtlSec: 86400,
      });

      const saved = clientRepo.save.mock.calls[0][0] as ClientModel;
      expect(saved.applicationType).toBe('native');
      expect(saved.backchannelLogoutUri).toBe(
        'https://app.example.com/bc-logout',
      );
      expect(saved.frontchannelLogoutUri).toBe(
        'https://app.example.com/fc-logout',
      );
      expect(saved.allowedResources).toEqual(['https://api.example.com']);
      expect(saved.accessTokenTtlSec).toBe(900);
      expect(saved.refreshTokenTtlSec).toBe(86400);
    });

    it('허용되지 않은 grant type 정책이면 BadRequestException을 던진다', async () => {
      grantTypeRegistry.validateClientGrantTypes.mockResolvedValue([
        { grantType: 'client_credentials', reason: 'client_auth_required' },
      ]);

      await expect(
        handler.createClient('tenant-1', {
          clientId: 'bad-client',
          name: 'Bad Client',
          grantTypes: ['client_credentials'],
          tokenEndpointAuthMethod: 'none',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(clientRepo.save).not.toHaveBeenCalled();
    });

    it('custom scope가 registry에 등록되어 있으면 정규화해 저장한다', async () => {
      await handler.createClient('tenant-1', {
        clientId: 'custom-scope-client',
        name: 'Custom Scope Client',
        scope: 'openid  orders:read   profile orders:read',
      });

      expect(scopeRegistry.validateClientScopes).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        scopes: ['openid', 'orders:read', 'profile'],
      });
      const saved = clientRepo.save.mock.calls[0][0] as ClientModel;
      expect(saved.scope).toBe('openid orders:read profile');
    });

    it('지원하지 않는 scope 정책이면 BadRequestException을 던진다', async () => {
      scopeRegistry.validateClientScopes.mockResolvedValue([
        { scope: 'payments:write', reason: 'unsupported' },
      ]);

      await expect(
        handler.createClient('tenant-1', {
          clientId: 'bad-scope-client',
          name: 'Bad Scope Client',
          scope: 'openid payments:write',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(clientRepo.save).not.toHaveBeenCalled();
    });

    it.each([
      [
        {
          type: 'public' as const,
          secret: 's'.repeat(32),
          tokenEndpointAuthMethod: 'client_secret_basic',
        },
        'client_type_not_allowed',
      ],
      [
        {
          type: 'service' as const,
          tokenEndpointAuthMethod: 'client_secret_basic',
        },
        'client_secret_required',
      ],
      [
        {
          type: 'service' as const,
          secret: 's'.repeat(32),
          tokenEndpointAuthMethod: 'client_secret_post',
        },
        'client_auth_method_not_allowed',
      ],
    ])(
      'introspection resource를 가진 잘못된 service 설정을 거부한다',
      async (overrides, reason) => {
        await expect(
          handler.createClient('tenant-1', {
            clientId: 'orders-api',
            name: 'Orders API',
            introspectionResources: ['https://api.example.com'],
            ...overrides,
          }),
        ).rejects.toMatchObject({
          response: expect.objectContaining({ issues: [reason] }),
        });
        expect(clientRepo.save).not.toHaveBeenCalled();
      },
    );

    it('service client의 introspection resources를 origin으로 정규화하고 중복 제거한다', async () => {
      await handler.createClient('tenant-1', {
        clientId: 'orders-api',
        name: 'Orders API',
        type: 'service',
        secret: 's'.repeat(32),
        grantTypes: ['client_credentials'],
        tokenEndpointAuthMethod: 'client_secret_basic',
        introspectionResources: [
          'https://api.example.com/orders',
          'https://api.example.com/customers',
        ],
      });

      const saved = clientRepo.save.mock.calls[0][0] as ClientModel;
      expect(saved.introspectionResources).toEqual(['https://api.example.com']);
    });
  });

  describe('updateClient', () => {
    it('findById → save 순서로 호출된다', async () => {
      await handler.updateClient('tenant-1', 'client-1', { name: 'Updated' });

      expect(clientRepo.findById).toHaveBeenCalledWith('client-1');
      expect(clientRepo.save).toHaveBeenCalledTimes(1);
    });

    it('클라이언트가 없으면 NotFoundException을 던진다', async () => {
      clientRepo.findById.mockResolvedValue(null);

      await expect(
        handler.updateClient('tenant-1', 'no-such', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('tenantId 불일치 시 NotFoundException을 던진다', async () => {
      clientRepo.findById.mockResolvedValue(
        makeClient('client-1', 'other-tenant'),
      );

      await expect(
        handler.updateClient('tenant-1', 'client-1', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('secret 변경 시 암호화하여 저장한다', async () => {
      await handler.updateClient('tenant-1', 'client-1', {
        secret: 'new-secret',
      });

      expect(crypto.encrypt).toHaveBeenCalledWith('new-secret');
    });

    it('secret을 null로 설정하면 secretEnc가 null이 된다', async () => {
      await handler.updateClient('tenant-1', 'client-1', {
        secret: null,
      });

      expect(crypto.encrypt).not.toHaveBeenCalled();
      const saved = clientRepo.save.mock.calls[0][0] as ClientModel;
      expect(saved.secretEnc).toBeNull();
    });

    it('factory DTO audit에는 실제 변경 필드만 기록하고 secret 이름은 제외한다', async () => {
      const dto = ApplicationUpdateClientDto.of({
        secret: 's'.repeat(32),
        name: 'Updated',
        frontchannelLogoutUri: null,
      });

      await handler.updateClient('tenant-1', 'client-1', dto);

      expect(auditRecorder.recordAdminAction).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        action: 'UPDATE',
        resourceType: 'client',
        resourceId: 'client-1',
        metadata: {
          changedFields: ['name', 'frontchannelLogoutUri'],
          secretChanged: true,
        },
        auditContext: undefined,
      });
      const metadata = auditRecorder.recordAdminAction.mock.calls[0][0]
        .metadata as { changedFields: string[] };
      expect(metadata.changedFields).not.toContain('secret');
    });

    it('신규 필드를 업데이트할 수 있다', async () => {
      await handler.updateClient('tenant-1', 'client-1', {
        applicationType: 'native',
        backchannelLogoutUri: 'https://new.example.com/bc',
        frontchannelLogoutUri: null,
        allowedResources: ['https://api2.example.com'],
      });

      const saved = clientRepo.save.mock.calls[0][0] as ClientModel;
      expect(saved.applicationType).toBe('native');
      expect(saved.backchannelLogoutUri).toBe('https://new.example.com/bc');
      expect(saved.frontchannelLogoutUri).toBeNull();
      expect(saved.allowedResources).toEqual(['https://api2.example.com']);
    });

    it('backchannelLogoutUri에 null을 주면 값을 제거한다', async () => {
      const client = makeClient();
      client.changeBackchannelLogoutUri('https://existing.example.com/bc');
      clientRepo.findById.mockResolvedValue(client);

      await handler.updateClient('tenant-1', 'client-1', {
        backchannelLogoutUri: null,
      });

      const saved = clientRepo.save.mock.calls[0][0] as ClientModel;
      expect(saved.backchannelLogoutUri).toBeNull();
    });

    it('보안 및 리다이렉트 관련 필드를 함께 업데이트할 수 있다', async () => {
      await handler.updateClient('tenant-1', 'client-1', {
        enabled: false,
        redirectUris: ['https://updated.example.com/callback'],
        grantTypes: ['authorization_code', 'refresh_token'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'client_secret_post',
        scope: 'openid profile email',
        postLogoutRedirectUris: ['https://updated.example.com/logout'],
        skipConsent: true,
        accessTokenTtlSec: 1200,
        refreshTokenTtlSec: null,
      });

      const saved = clientRepo.save.mock.calls[0][0] as ClientModel;
      expect(saved.enabled).toBe(false);
      expect(saved.redirectUris).toEqual([
        'https://updated.example.com/callback',
      ]);
      expect(saved.grantTypes).toEqual(['authorization_code', 'refresh_token']);
      expect(saved.responseTypes).toEqual(['code']);
      expect(saved.tokenEndpointAuthMethod).toBe('client_secret_post');
      expect(saved.scope).toBe('openid profile email');
      expect(saved.postLogoutRedirectUris).toEqual([
        'https://updated.example.com/logout',
      ]);
      expect(saved.skipConsent).toBe(true);
      expect(saved.accessTokenTtlSec).toBe(1200);
      expect(saved.refreshTokenTtlSec).toBeNull();
    });

    it('scope 변경 시 registry 정책으로 검증한 뒤 정규화한다', async () => {
      await handler.updateClient('tenant-1', 'client-1', {
        scope: 'openid  orders:read orders:read',
      });

      expect(scopeRegistry.validateClientScopes).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        scopes: ['openid', 'orders:read'],
      });
      const saved = clientRepo.save.mock.calls[0][0] as ClientModel;
      expect(saved.scope).toBe('openid orders:read');
    });

    it('grantTypes 변경 시 최종 client 정책을 검증한다', async () => {
      await handler.updateClient('tenant-1', 'client-1', {
        grantTypes: ['authorization_code', 'refresh_token'],
      });

      expect(grantTypeRegistry.validateClientGrantTypes).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        clientType: 'public',
        applicationType: 'web',
        tokenEndpointAuthMethod: 'none',
        grantTypes: ['authorization_code', 'refresh_token'],
      });
    });

    it('grantTypes 변경이 정책에 맞지 않으면 저장하지 않는다', async () => {
      grantTypeRegistry.validateClientGrantTypes.mockResolvedValue([
        {
          grantType: 'refresh_token',
          reason: 'required_grant_missing',
          requiredGrantType: 'authorization_code',
        },
      ]);

      await expect(
        handler.updateClient('tenant-1', 'client-1', {
          grantTypes: ['refresh_token'],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(clientRepo.save).not.toHaveBeenCalled();
    });

    it('allowlist가 남아 있으면 기존 secret 제거를 거부한다', async () => {
      clientRepo.findById.mockResolvedValue(makeServiceClient());

      await expect(
        handler.updateClient('tenant-1', 'client-1', { secret: null }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          issues: ['client_secret_required'],
        }),
      });
      expect(clientRepo.save).not.toHaveBeenCalled();
    });

    it('allowlist가 남아 있으면 인증 방식 변경을 거부한다', async () => {
      clientRepo.findById.mockResolvedValue(makeServiceClient());

      await expect(
        handler.updateClient('tenant-1', 'client-1', {
          tokenEndpointAuthMethod: 'client_secret_post',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          issues: ['client_auth_method_not_allowed'],
        }),
      });
      expect(clientRepo.save).not.toHaveBeenCalled();
    });

    it('update introspection resources를 origin으로 정규화하고 중복 제거한다', async () => {
      clientRepo.findById.mockResolvedValue(makeServiceClient());

      await handler.updateClient('tenant-1', 'client-1', {
        introspectionResources: [
          'https://API.example.com/orders',
          'https://api.example.com/customers',
        ],
      });

      const saved = clientRepo.save.mock.calls[0][0] as ClientModel;
      expect(saved.introspectionResources).toEqual(['https://api.example.com']);
    });

    it('유효한 service client update에서도 잘못된 origin을 거부한다', async () => {
      clientRepo.findById.mockResolvedValue(makeServiceClient());

      await expect(
        handler.updateClient('tenant-1', 'client-1', {
          introspectionResources: ['http://api.example.com/orders'],
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          issues: ['invalid_resource_origin'],
        }),
      });
      expect(clientRepo.save).not.toHaveBeenCalled();
    });

    it.each([
      [{ secret: null, introspectionResources: [] }],
      [
        {
          tokenEndpointAuthMethod: 'client_secret_post',
          introspectionResources: [],
        },
      ],
    ])(
      '같은 update에서 allowlist를 비우면 제한된 변경을 허용한다',
      async (dto) => {
        clientRepo.findById.mockResolvedValue(makeServiceClient());

        await handler.updateClient('tenant-1', 'client-1', dto);

        const saved = clientRepo.save.mock.calls[0][0] as ClientModel;
        expect(saved.introspectionResources).toEqual([]);
      },
    );
  });

  describe('updateClientAuthPolicy', () => {
    it('클라이언트별 refresh token 정책을 수정한다', async () => {
      const policy = makeClientAuthPolicy('client-1');
      clientAuthPolicyRepo.findByClientRefId.mockResolvedValue(policy);

      await handler.updateClientAuthPolicy('tenant-1', 'client-1', {
        refreshTokenRotationEnabled: false,
        refreshTokenReuseAction: 'revoke_grant',
      });

      expect(clientRepo.findById).toHaveBeenCalledWith('client-1');
      expect(clientAuthPolicyRepo.findByClientRefId).toHaveBeenCalledWith(
        'client-1',
      );
      expect(clientAuthPolicyRepo.save).toHaveBeenCalledWith(policy);
      expect(policy.refreshTokenRotationEnabled).toBe(false);
      expect(policy.refreshTokenReuseAction).toBe('revoke_grant');
    });

    it('클라이언트별 IdP와 재인증 override를 수정한다', async () => {
      const policy = makeClientAuthPolicy('client-1');
      clientAuthPolicyRepo.findByClientRefId.mockResolvedValue(policy);

      await handler.updateClientAuthPolicy('tenant-1', 'client-1', {
        allowedIdpProviderKeys: ['okta'],
        reauthenticationIntervalSec: 1800,
      });

      expect(clientAuthPolicyRepo.save).toHaveBeenCalledWith(policy);
      expect(policy.allowedIdpProviderKeys).toEqual(['okta']);
      expect(policy.reauthenticationIntervalSec).toBe(1800);
    });

    it('클라이언트별 single login override를 수정한다', async () => {
      const policy = makeClientAuthPolicy('client-1');
      clientAuthPolicyRepo.findByClientRefId.mockResolvedValue(policy);

      await handler.updateClientAuthPolicy('tenant-1', 'client-1', {
        loginSessionMode: 'single',
        maxConcurrentSessions: 1,
        sessionConflictAction: 'deny_new_login',
      });

      expect(clientAuthPolicyRepo.save).toHaveBeenCalledWith(policy);
      expect(policy.loginSessionMode).toBe('single');
      expect(policy.maxConcurrentSessions).toBe(1);
      expect(policy.sessionConflictAction).toBe('deny_new_login');
    });

    it('single login override를 null로 돌려 tenant 정책 상속으로 복귀한다', async () => {
      const policy = makeClientAuthPolicy('client-1');
      policy.changeLoginSessionMode('single');
      policy.changeMaxConcurrentSessions(1);
      policy.changeSessionConflictAction('deny_new_login');
      clientAuthPolicyRepo.findByClientRefId.mockResolvedValue(policy);

      await handler.updateClientAuthPolicy('tenant-1', 'client-1', {
        loginSessionMode: null,
        maxConcurrentSessions: null,
        sessionConflictAction: null,
      });

      expect(policy.loginSessionMode).toBeNull();
      expect(policy.maxConcurrentSessions).toBeNull();
      expect(policy.sessionConflictAction).toBeNull();
    });

    it('기존 정책이 없으면 기본 정책을 생성한 뒤 수정한다', async () => {
      clientAuthPolicyRepo.findByClientRefId.mockResolvedValue(null);

      await handler.updateClientAuthPolicy('tenant-1', 'client-1', {
        mfaRequired: true,
        refreshTokenRotationEnabled: true,
      });

      const saved = clientAuthPolicyRepo.save.mock.calls[0][0];
      expect(saved.clientRefId).toBe('client-1');
      expect(saved.mfaRequired).toBe(true);
      expect(saved.refreshTokenRotationEnabled).toBe(true);
    });

    it('클라이언트가 없으면 NotFoundException을 던진다', async () => {
      clientRepo.findById.mockResolvedValue(null);

      await expect(
        handler.updateClientAuthPolicy('tenant-1', 'no-such', {
          refreshTokenRotationEnabled: true,
        }),
      ).rejects.toThrow(NotFoundException);

      expect(clientAuthPolicyRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('deleteClient', () => {
    it('findById → delete 순서로 호출된다', async () => {
      await handler.deleteClient('tenant-1', 'client-1');

      expect(clientRepo.findById).toHaveBeenCalledWith('client-1');
      expect(clientRepo.delete).toHaveBeenCalledWith('client-1');
    });

    it('클라이언트가 없으면 NotFoundException을 던진다', async () => {
      clientRepo.findById.mockResolvedValue(null);

      await expect(handler.deleteClient('tenant-1', 'no-such')).rejects.toThrow(
        NotFoundException,
      );

      expect(clientRepo.delete).not.toHaveBeenCalled();
    });

    it('tenantId 불일치 시 NotFoundException을 던진다', async () => {
      clientRepo.findById.mockResolvedValue(
        makeClient('client-1', 'other-tenant'),
      );

      await expect(
        handler.deleteClient('tenant-1', 'client-1'),
      ).rejects.toThrow(NotFoundException);

      expect(clientRepo.delete).not.toHaveBeenCalled();
    });
  });
});
