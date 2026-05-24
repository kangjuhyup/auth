import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClientCommandHandler } from '@application/commands/handlers/client-command.handler';
import type {
  ClientAuthPolicyRepository,
  ClientRepository,
} from '@domain/repositories';
import type { SymmetricCryptoPort } from '@application/ports/symmetric-crypto.port';
import { ClientModel } from '@domain/models/client';
import { ClientAuthPolicyModel } from '@domain/models/client-auth-policy';

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
    skipConsent: false,
    accessTokenTtlSec: null,
    refreshTokenTtlSec: null,
  });
  c.setPersistence(id, new Date(), new Date());
  return c;
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

describe('ClientCommandHandler', () => {
  let handler: ClientCommandHandler;
  let clientRepo: jest.Mocked<ClientRepository>;
  let clientAuthPolicyRepo: jest.Mocked<ClientAuthPolicyRepository>;
  let crypto: jest.Mocked<SymmetricCryptoPort>;

  beforeEach(() => {
    jest.clearAllMocks();
    clientRepo = createMockClientRepo();
    clientAuthPolicyRepo = createMockClientAuthPolicyRepo();
    crypto = createMockCrypto();
    handler = new ClientCommandHandler(
      clientRepo,
      clientAuthPolicyRepo,
      crypto,
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
