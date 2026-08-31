import {
  createOidcProvider,
  type CreateOidcProviderParams,
} from '@infrastructure/oidc-provider/oidc-provider.factory';
import { TenantModel } from '@domain/models/tenant';
import { TenantConfigModel } from '@domain/models/tenant-config';
import { JwksKeyModel } from '@domain/models/jwks-key';
import { buildOidcConfiguration } from '@infrastructure/oidc-provider/oidc-provider.config';
import { loadOidcProviderConstructor } from '@infrastructure/oidc-provider/oidc-provider.loader';
import { registerCustomGrantTypes } from '@infrastructure/oidc-provider/custom-grants/register-custom-grant-types';
import { createPrivateKey } from 'node:crypto';
import { EventEmitter } from 'node:events';

jest.mock('@infrastructure/oidc-provider/oidc-provider.config', () => ({
  buildOidcConfiguration: jest.fn(),
}));

jest.mock('@infrastructure/oidc-provider/oidc-provider.loader', () => ({
  loadOidcProviderConstructor: jest.fn(),
}));

jest.mock(
  '@infrastructure/oidc-provider/custom-grants/register-custom-grant-types',
  () => ({
    registerCustomGrantTypes: jest.fn(),
  }),
);

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

function makeJwksKey(
  overrides?: Partial<{ kid: string; privateKeyEnc: string }>,
): JwksKeyModel {
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

function createParams(): CreateOidcProviderParams & {
  metrics: { incrementCounter: jest.Mock };
} {
  return {
    issuer: 'https://auth.example.com/t/acme/oidc',
    em: {} as any,
    redis: {} as any,
    userQuery: {} as any,
    clientQuery: {} as any,
    configService: {} as any,
    tenantCode: 'acme',
    clientRepository: {
      findByClientId: jest.fn().mockResolvedValue({ id: 'client-ref-1' }),
    } as any,
    clientAuthPolicyRepository: {} as any,
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
    eventRepository: {
      save: jest.fn().mockResolvedValue(undefined),
      list: jest.fn(),
    } as any,
    customGrantRepository: {
      listByTenantId: jest.fn().mockResolvedValue([]),
    } as any,
    jwksKeyCrypto: {
      generateKeyPair: jest.fn(),
    } as any,
    symmetricCrypto: {
      decrypt: jest.fn().mockReturnValue('decrypted-private-key-pem'),
      encrypt: jest.fn(),
    } as any,
    grantTypeRegistry: {
      listSupportedGrantTypes: jest
        .fn()
        .mockResolvedValue([
          'authorization_code',
          'refresh_token',
          'client_credentials',
          'implicit',
        ]),
    } as any,
    scopeRegistry: {
      listSupportedScopes: jest
        .fn()
        .mockResolvedValue(['openid', 'profile', 'email', 'orders:read']),
    } as any,
    scopeClaimResolver: {
      resolve: jest.fn(),
    } as any,
    metrics: {
      incrementCounter: jest.fn(),
      observeLatency: jest.fn(),
      snapshot: jest.fn(),
    } as any,
  };
}

describe('createOidcProvider', () => {
  const providerConfiguration = { cookies: { keys: ['k1', 'k2'] } };
  const ProviderConstructor = jest
    .fn()
    .mockImplementation((issuer: string, configuration: unknown) => {
      const provider = Object.assign(new EventEmitter(), {
        issuer,
        configuration,
      });
      provider.on = jest.fn(provider.on.bind(provider));
      return provider;
    });

  beforeEach(() => {
    jest.clearAllMocks();

    (buildOidcConfiguration as jest.Mock).mockReturnValue(
      providerConfiguration,
    );
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
    expect(params.tenantConfigRepository.findByTenantId).toHaveBeenCalledWith(
      'tenant-1',
    );
    expect(params.jwksKeyRepository.findActiveByTenantId).toHaveBeenCalledWith(
      'tenant-1',
    );
    expect(
      params.grantTypeRegistry.listSupportedGrantTypes,
    ).toHaveBeenCalledWith('tenant-1');
    expect(params.symmetricCrypto.decrypt).toHaveBeenCalledWith(
      'encrypted-private-key',
    );
    expect(createPrivateKey).toHaveBeenCalledWith('decrypted-private-key-pem');
    expect(buildOidcConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        tenantCode: 'acme',
        supportedGrantTypes: [
          'authorization_code',
          'refresh_token',
          'client_credentials',
          'implicit',
        ],
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
    expect(registerCustomGrantTypes).toHaveBeenCalledWith(
      provider,
      expect.objectContaining({
        tenantCode: 'acme',
        configService: params.configService,
        userQuery: params.userQuery,
        clientQuery: params.clientQuery,
        eventRepository: params.eventRepository,
      }),
      [],
    );
    expect(provider).toMatchObject({
      issuer: 'https://auth.example.com/t/acme/oidc',
      configuration: providerConfiguration,
    });
    expect((provider as any).on).toHaveBeenCalledWith(
      'grant.revoked',
      expect.any(Function),
    );
  });

  it('활성 키가 없으면 새 키를 생성하고 저장한 뒤 Provider를 만든다', async () => {
    const params = createParams();
    params.tenantConfigRepository.findByTenantId = jest
      .fn()
      .mockResolvedValue(null);
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

    const savedKey = (params.jwksKeyRepository.save as jest.Mock).mock
      .calls[0][0] as JwksKeyModel;
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

  it('테넌트를 찾지 못하면 provider를 생성하지 않고 실패한다', async () => {
    const params = createParams();
    params.tenantRepository.findByCode = jest.fn().mockResolvedValue(null);

    await expect(createOidcProvider(params)).rejects.toThrow(
      'OIDC tenant not found',
    );

    expect(params.tenantConfigRepository.findByTenantId).not.toHaveBeenCalled();
    expect(
      params.jwksKeyRepository.findActiveByTenantId,
    ).not.toHaveBeenCalled();
    expect(params.jwksKeyCrypto.generateKeyPair).not.toHaveBeenCalled();
    expect(buildOidcConfiguration).not.toHaveBeenCalled();
    expect(ProviderConstructor).not.toHaveBeenCalled();
  });

  it('rotated refresh token 재사용으로 grant가 revoke되면 보안 감사 이벤트를 저장한다', async () => {
    const params = createParams();
    const provider = await createOidcProvider(params);

    const listener = (provider as any).on.mock.calls.find(
      ([event]: [string, unknown]) => event === 'grant.revoked',
    )?.[1];
    expect(listener).toEqual(expect.any(Function));

    listener(
      {
        req: { tenant: { id: 'tenant-1' }, correlationId: 'req-1' },
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
        oidc: {
          route: 'token',
          params: { grant_type: 'refresh_token' },
          client: { clientId: 'app-web' },
          entities: {
            RefreshToken: {
              consumed: true,
              accountId: 'user-1',
              clientId: 'app-web',
              rotations: 2,
            },
          },
        },
      },
      'grant-1',
    );
    await Promise.resolve();

    expect(params.eventRepository.save).toHaveBeenCalledTimes(1);
    const event = (params.eventRepository.save as jest.Mock).mock.calls[0][0];
    expect(event.tenantId).toBe('tenant-1');
    expect(event.userId).toBe('user-1');
    expect(event.clientId).toBe('client-ref-1');
    expect(event.category).toBe('SECURITY');
    expect(event.action).toBe('TOKEN_REVOKED');
    expect(event.reason).toBe('RefreshTokenReuseDetected');
    expect(event.resourceId).toBe('grant-1');
    expect(event.correlationId).toBe('req-1');
    expect(event.metadata).toEqual({
      grantType: 'refresh_token',
      action: 'revoke_grant',
      rotations: 2,
    });
  });

  it('real provider introspection.error invalid_client를 client FK로 best-effort 감사한다', async () => {
    const params = createParams();
    const provider = await createOidcProvider(params);

    (provider as any).emit(
      'introspection.error',
      {
        req: { tenant: { id: 'tenant-1' }, correlationId: 'req-1' },
        get: jest.fn().mockReturnValue('test-agent'),
        oidc: {
          client: { clientId: 'orders-api' },
          params: { client_id: 'orders-api' },
        },
      },
      { error: 'invalid_client' },
    );
    await Promise.resolve();
    await Promise.resolve();

    const event = (params.eventRepository.save as jest.Mock).mock.calls[0][0];
    expect(event.clientId).toBe('client-ref-1');
    expect(event.resourceId).toBe('orders-api');
    expect(event.metadata).toEqual({
      tenantCode: 'acme',
      endpoint: 'introspection',
    });
    expect(params.metrics.incrementCounter).toHaveBeenCalledWith(
      'invalid_client_total',
      { tenantCode: 'acme' },
    );
  });

  it('provider 감사 필드를 event 저장소 한도에 맞추고 검증된 IP를 보존한다', async () => {
    const params = createParams();
    const provider = await createOidcProvider(params);
    const publicClientId = 'c'.repeat(255);
    const userAgent = 'u'.repeat(300);
    const correlationId = 'r'.repeat(200);

    (provider as any).emit(
      'introspection.error',
      {
        ip: '2001:db8::1',
        req: { tenant: { id: 'tenant-1' }, correlationId },
        get: jest.fn().mockReturnValue(userAgent),
        oidc: {
          params: { client_id: publicClientId },
        },
      },
      { error: 'invalid_client' },
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(params.clientRepository.findByClientId).toHaveBeenCalledWith(
      'tenant-1',
      publicClientId,
    );
    const event = (params.eventRepository.save as jest.Mock).mock.calls[0][0];
    expect(event.resourceId).toBe('c'.repeat(191));
    expect(event.userAgent).toBe('u'.repeat(255));
    expect(event.correlationId).toBe('r'.repeat(128));
    expect(event.ip).toEqual(Buffer.from('2001:db8::1', 'utf8'));
  });

  it('unknown Basic client과 감사 저장 실패가 real provider 401 rendering을 방해하지 않는다', async () => {
    const params = createParams();
    params.clientRepository.findByClientId = jest.fn().mockResolvedValue(null);
    params.eventRepository.save = jest
      .fn()
      .mockRejectedValue(new Error('audit persistence failed'));
    const provider = await createOidcProvider(params);

    expect(() => {
      (provider as any).emit(
        'introspection.error',
        {
          req: {
            tenant: { id: 'tenant-1' },
            headers: {
              authorization: `Basic ${Buffer.from(
                ['missing-client', 'REDACTED'].join(':'),
              ).toString('base64')}`,
            },
          },
          oidc: { params: {} },
        },
        { error: 'invalid_client' },
      );
    }).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    const event = (params.eventRepository.save as jest.Mock).mock.calls[0][0];
    expect(event.clientId).toBeNull();
    expect(event.resourceId).toBe('missing-client');
  });

  it('grant.error invalid_client 감사와 metric 실패가 provider emit을 방해하지 않는다', async () => {
    const params = createParams();
    params.metrics.incrementCounter.mockImplementationOnce(() => {
      throw new Error('metrics unavailable');
    });
    const provider = await createOidcProvider(params);

    expect(() => {
      (provider as any).emit(
        'grant.error',
        {
          req: { tenant: { id: 'tenant-1' } },
          oidc: {
            client: { clientId: 'orders-api' },
            params: {
              client_id: 'orders-api',
              grant_type: 'client_credentials',
            },
          },
        },
        { error: 'invalid_client' },
      );
    }).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    const event = (params.eventRepository.save as jest.Mock).mock.calls[0][0];
    expect(event.clientId).toBe('client-ref-1');
    expect(event.metadata).toEqual({
      tenantCode: 'acme',
      endpoint: 'token',
      grantType: 'client_credentials',
    });
  });

  it('provider의 invalid_client 이외 error는 인증 실패로 감사하지 않는다', async () => {
    const params = createParams();
    const provider = await createOidcProvider(params);

    (provider as any).emit(
      'introspection.error',
      { req: { tenant: { id: 'tenant-1' } } },
      { error: 'invalid_request' },
    );
    await Promise.resolve();

    expect(params.clientRepository.findByClientId).not.toHaveBeenCalled();
    expect(params.eventRepository.save).not.toHaveBeenCalled();
    expect(params.metrics.incrementCounter).not.toHaveBeenCalled();
  });
});
