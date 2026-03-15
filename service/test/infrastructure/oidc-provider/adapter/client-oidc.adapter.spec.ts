import { ClientOidcAdapter } from '@infrastructure/oidc-provider/adapters/client-oidc.adapter';
import type { ClientRepository, TenantRepository } from '@domain/repositories';
import type { SymmetricCryptoPort } from '@application/ports/symmetric-crypto.port';
import { ClientModel } from '@domain/models/client';
import { TenantModel } from '@domain/models/tenant';

function makeTenant(id = 'tenant-1', code = 'acme'): TenantModel {
  const t = new TenantModel({ code, name: 'ACME' });
  t.setPersistence(id, new Date(), new Date());
  return t;
}

function makeClient(overrides: Partial<{
  secretEnc: string | null;
  enabled: boolean;
  applicationType: 'web' | 'native';
  backchannelLogoutUri: string | null;
  frontchannelLogoutUri: string | null;
}> = {}): ClientModel {
  const c = new ClientModel({
    tenantId: 'tenant-1',
    clientId: 'my-app',
    secretEnc: 'secretEnc' in overrides ? overrides.secretEnc : 'encrypted-secret',
    name: 'My App',
    type: 'confidential',
    enabled: overrides.enabled ?? true,
    redirectUris: ['https://app.example.com/callback'],
    grantTypes: ['authorization_code'],
    responseTypes: ['code'],
    tokenEndpointAuthMethod: 'client_secret_basic',
    scope: 'openid profile',
    postLogoutRedirectUris: ['https://app.example.com/logout'],
    applicationType: overrides.applicationType ?? 'web',
    backchannelLogoutUri: overrides.backchannelLogoutUri ?? 'https://app.example.com/bc',
    frontchannelLogoutUri: overrides.frontchannelLogoutUri ?? null,
    allowedResources: ['https://api.example.com'],
  });
  c.setPersistence('1', new Date(), new Date());
  return c;
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

function createMockTenantRepo(): jest.Mocked<TenantRepository> {
  return {
    findByCode: jest.fn().mockResolvedValue(makeTenant()),
    findById: jest.fn(),
    list: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

function createMockCrypto(): jest.Mocked<SymmetricCryptoPort> {
  return {
    encrypt: jest.fn(),
    decrypt: jest.fn().mockImplementation((v: string) => `decrypted:${v}`),
  };
}

describe('ClientOidcAdapter', () => {
  let adapter: ClientOidcAdapter;
  let clientRepo: jest.Mocked<ClientRepository>;
  let tenantRepo: jest.Mocked<TenantRepository>;
  let crypto: jest.Mocked<SymmetricCryptoPort>;

  beforeEach(() => {
    jest.clearAllMocks();
    clientRepo = createMockClientRepo();
    tenantRepo = createMockTenantRepo();
    crypto = createMockCrypto();
    adapter = new ClientOidcAdapter('acme', clientRepo, tenantRepo, crypto);
  });

  describe('find', () => {
    it('clientId로 클라이언트를 조회하여 AdapterPayload를 반환한다', async () => {
      clientRepo.findByClientId.mockResolvedValue(makeClient());

      const result = await adapter.find('my-app');

      expect(tenantRepo.findByCode).toHaveBeenCalledWith('acme');
      expect(clientRepo.findByClientId).toHaveBeenCalledWith('tenant-1', 'my-app');
      expect(result).toBeDefined();
      expect(result!.client_id).toBe('my-app');
      expect(result!.redirect_uris).toEqual(['https://app.example.com/callback']);
      expect(result!.grant_types).toEqual(['authorization_code']);
      expect(result!.response_types).toEqual(['code']);
      expect(result!.token_endpoint_auth_method).toBe('client_secret_basic');
      expect(result!.scope).toBe('openid profile');
      expect(result!.post_logout_redirect_uris).toEqual(['https://app.example.com/logout']);
      expect(result!.application_type).toBe('web');
      expect(result!.backchannel_logout_uri).toBe('https://app.example.com/bc');
      expect(result!.frontchannel_logout_uri).toBeUndefined();
    });

    it('secretEnc가 있으면 복호화하여 client_secret에 넣는다', async () => {
      clientRepo.findByClientId.mockResolvedValue(makeClient({ secretEnc: 'enc-val' }));

      const result = await adapter.find('my-app');

      expect(crypto.decrypt).toHaveBeenCalledWith('enc-val');
      expect(result!.client_secret).toBe('decrypted:enc-val');
    });

    it('secretEnc가 null이면 client_secret이 undefined다', async () => {
      clientRepo.findByClientId.mockResolvedValue(makeClient({ secretEnc: null }));

      const result = await adapter.find('my-app');

      expect(crypto.decrypt).not.toHaveBeenCalled();
      expect(result!.client_secret).toBeUndefined();
    });

    it('클라이언트가 없으면 undefined를 반환한다', async () => {
      clientRepo.findByClientId.mockResolvedValue(null);

      const result = await adapter.find('nonexistent');

      expect(result).toBeUndefined();
    });

    it('비활성 클라이언트는 undefined를 반환한다', async () => {
      clientRepo.findByClientId.mockResolvedValue(makeClient({ enabled: false }));

      const result = await adapter.find('my-app');

      expect(result).toBeUndefined();
    });

    it('tenantCode로 tenant를 찾을 수 없으면 예외를 던진다', async () => {
      tenantRepo.findByCode.mockResolvedValue(null);

      await expect(adapter.find('my-app')).rejects.toThrow(/Tenant not found/);
    });

    it('tenantId는 캐시되어 두 번째 호출에서 재조회하지 않는다', async () => {
      clientRepo.findByClientId.mockResolvedValue(makeClient());

      await adapter.find('my-app');
      await adapter.find('my-app');

      expect(tenantRepo.findByCode).toHaveBeenCalledTimes(1);
    });
  });

  describe('write methods (no-op)', () => {
    it('upsert는 아무것도 하지 않는다', async () => {
      await expect(adapter.upsert('id', {} as any, 3600)).resolves.toBeUndefined();
    });

    it('consume은 아무것도 하지 않는다', async () => {
      await expect(adapter.consume('id')).resolves.toBeUndefined();
    });

    it('destroy는 아무것도 하지 않는다', async () => {
      await expect(adapter.destroy('id')).resolves.toBeUndefined();
    });

    it('revokeByGrantId는 아무것도 하지 않는다', async () => {
      await expect(adapter.revokeByGrantId('grant-1')).resolves.toBeUndefined();
    });
  });

  describe('unsupported find methods', () => {
    it('findByUid는 undefined를 반환한다', async () => {
      const result = await adapter.findByUid('uid-1');
      expect(result).toBeUndefined();
    });

    it('findByUserCode는 undefined를 반환한다', async () => {
      const result = await adapter.findByUserCode('code-1');
      expect(result).toBeUndefined();
    });
  });
});
