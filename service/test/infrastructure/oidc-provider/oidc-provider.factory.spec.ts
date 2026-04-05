import { createOidcProvider, type CreateOidcProviderParams } from '@infrastructure/oidc-provider/oidc-provider.factory';
import { TenantModel } from '@domain/models/tenant';
import { TenantConfigModel } from '@domain/models/tenant-config';
import { JwksKeyModel } from '@domain/models/jwks-key';
import { buildOidcConfiguration } from '@infrastructure/oidc-provider/oidc-provider.config';
import { loadOidcProviderConstructor } from '@infrastructure/oidc-provider/oidc-provider.loader';
import { createPrivateKey } from 'node:crypto';

jest.mock('@infrastructure/oidc-provider/oidc-provider.config', () => ({
  buildOidcConfiguration: jest.fn(),
}));

jest.mock('@infrastructure/oidc-provider/oidc-provider.loader', () => ({
  loadOidcProviderConstructor: jest.fn(),
}));

jest.mock('node:crypto', () => ({
  createPrivateKey: jest.fn(),
}));

function makeTenant(id = 'tenant-1', code = 'acme'): TenantModel {
  const tenant = new TenantModel({ code, name: 'Acme Corp' });
  tenant.setPersistence(id, new Date('2025-01-01'), new Date('2025-01-02'));
  return tenant;
}

function makeTenantConfig(
  overrides?: Partial<{
    accessTokenTtlSec: number;
    refreshTokenTtlSec: number;
  }>,
): TenantConfigModel {
  return new TenantConfigModel({
    tenantId: 'tenant-1',
    signupPolicy: 'open',
    requirePhoneVerify: false,
    brandName: 'Acme',
    accessTokenTtlSec: overrides?.accessTokenTtlSec ?? 120,
    refreshTokenTtlSec: overrides?.refreshTokenTtlSec ?? 240,
    extra: null,
  });
}

function makeJwksKey(overrides?: Partial<{ kid: string; privateKeyEnc: string }>): JwksKeyModel {
  return new JwksKeyModel({
    kid: overrides?.kid ?? 'kid-1',
    tenantId: 'tenant-1',
    algorithm: 'RS256',
    publicKey: 'public-key',
    privateKeyEnc: overrides?.privateKeyEnc ?? 'encrypted-private-key',
    status: 'active',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
  });
}

function createParams(): CreateOidcProviderParams {
  return {
    issuer: 'https://auth.example.com/t/acme/oidc',
    em: {} as any,
    redis: {} as any,
    userQuery: {} as any,
    clientQuery: {} as any,
    configService: {} as any,
    tenantCode: 'acme',
    clientRepository: {} as any,
    tenantRepository: {
      findByCode: jest.fn().mockResolvedValue(makeTenant()),
      findById: jest.fn(),
      list: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as any,
    tenantConfigRepository: {
      findByTenantId: jest.fn().mockResolvedValue(makeTenantConfig()),
      save: jest.fn(),
    } as any,
    jwksKeyRepository: {
      findActiveByTenantId: jest.fn().mockResolvedValue([makeJwksKey()]),
      save: jest.fn().mockResolvedValue(undefined),
      saveMany: jest.fn(),
    } as any,
    jwksKeyCrypto: {
      generateKeyPair: jest.fn(),
    } as any,
    symmetricCrypto: {
      decrypt: jest.fn().mockReturnValue('decrypted-private-key-pem'),
      encrypt: jest.fn(),
    } as any,
  };
}

describe('createOidcProvider', () => {
  const providerConfiguration = { cookies: { keys: ['k1', 'k2'] } };
  const ProviderConstructor = jest.fn().mockImplementation(
    (issuer: string, configuration: unknown) => ({
      issuer,
      configuration,
    }),
  );

  beforeEach(() => {
    jest.clearAllMocks();

    (buildOidcConfiguration as jest.Mock).mockReturnValue(providerConfiguration);
    (loadOidcProviderConstructor as jest.Mock).mockResolvedValue(
      ProviderConstructor,
    );
    (createPrivateKey as jest.Mock).mockReturnValue({
      export: jest.fn().mockReturnValue({
        kty: 'RSA',
        n: 'modulus',
        e: 'AQAB',
      }),
    });
  });

  it('기존 테넌트 설정과 활성 JWKS 키로 Provider를 생성한다', async () => {
    const params = createParams();

    const provider = await createOidcProvider(params);

    expect(params.tenantRepository.findByCode).toHaveBeenCalledWith('acme');
    expect(
      params.tenantConfigRepository.findByTenantId,
    ).toHaveBeenCalledWith('tenant-1');
    expect(params.jwksKeyRepository.findActiveByTenantId).toHaveBeenCalledWith(
      'tenant-1',
    );
    expect(params.symmetricCrypto.decrypt).toHaveBeenCalledWith(
      'encrypted-private-key',
    );
    expect(createPrivateKey).toHaveBeenCalledWith('decrypted-private-key-pem');
    expect(buildOidcConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantCode: 'acme',
        tenantAccessTokenTtlSec: 120,
        tenantRefreshTokenTtlSec: 240,
        jwksKeys: [
          {
            kty: 'RSA',
            n: 'modulus',
            e: 'AQAB',
            kid: 'kid-1',
            alg: 'RS256',
            use: 'sig',
          },
        ],
      }),
    );
    expect(ProviderConstructor).toHaveBeenCalledWith(
      'https://auth.example.com/t/acme/oidc',
      providerConfiguration,
    );
    expect(provider).toEqual({
      issuer: 'https://auth.example.com/t/acme/oidc',
      configuration: providerConfiguration,
    });
  });

  it('활성 키가 없으면 새 키를 생성하고 저장한 뒤 Provider를 만든다', async () => {
    const params = createParams();
    params.tenantConfigRepository.findByTenantId = jest.fn().mockResolvedValue(null);
    params.jwksKeyRepository.findActiveByTenantId = jest
      .fn()
      .mockResolvedValue([]);
    params.jwksKeyCrypto.generateKeyPair = jest.fn().mockResolvedValue({
      kid: 'generated-kid',
      algorithm: 'RS256',
      publicKeyPem: 'public-pem',
      privateKeyEncrypted: 'generated-private-enc',
    });
    (params.symmetricCrypto.decrypt as jest.Mock).mockReturnValue(
      'generated-private-key-pem',
    );

    await createOidcProvider(params);

    expect(params.jwksKeyCrypto.generateKeyPair).toHaveBeenCalledWith('RS256');
    expect(params.jwksKeyRepository.save).toHaveBeenCalledTimes(1);

    const savedKey = (params.jwksKeyRepository.save as jest.Mock).mock.calls[0][0] as JwksKeyModel;
    expect(savedKey.kid).toBe('generated-kid');
    expect(savedKey.publicKey).toBe('public-pem');
    expect(savedKey.privateKeyEnc).toBe('generated-private-enc');

    expect(buildOidcConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantAccessTokenTtlSec: 3600,
        tenantRefreshTokenTtlSec: 14 * 24 * 60 * 60,
        jwksKeys: [
          expect.objectContaining({
            kid: 'generated-kid',
            alg: 'RS256',
            use: 'sig',
          }),
        ],
      }),
    );
  });

  it('테넌트를 찾지 못하면 기본 TTL과 빈 JWKS로 Provider를 생성한다', async () => {
    const params = createParams();
    params.tenantRepository.findByCode = jest.fn().mockResolvedValue(null);

    await createOidcProvider(params);

    expect(params.tenantConfigRepository.findByTenantId).not.toHaveBeenCalled();
    expect(
      params.jwksKeyRepository.findActiveByTenantId,
    ).not.toHaveBeenCalled();
    expect(params.jwksKeyCrypto.generateKeyPair).not.toHaveBeenCalled();
    expect(buildOidcConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantAccessTokenTtlSec: 3600,
        tenantRefreshTokenTtlSec: 14 * 24 * 60 * 60,
        jwksKeys: [],
      }),
    );
  });
});
