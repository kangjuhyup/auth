import { OidcInteractionAdapter } from '@infrastructure/oidc-provider/oidc-interaction.adapter';
import { ClientAuthPolicyModel } from '@domain/models/client-auth-policy';
import { TenantConfigModel } from '@domain/models/tenant-config';

const tenant = { id: 'tenant-1', code: 'acme', name: 'Acme' };

function makeProvider(clientId = 'web-app') {
  return {
    interactionDetails: jest.fn().mockResolvedValue({
      prompt: { name: 'login', details: {} },
      params: { client_id: clientId },
    }),
    callback: jest.fn().mockReturnValue(jest.fn().mockResolvedValue(undefined)),
  };
}

function makeTenantConfig(providerKeys: string[] | null): TenantConfigModel {
  const config = new TenantConfigModel({
    tenantId: 'tenant-1',
    signupPolicy: 'invite',
    requirePhoneVerify: false,
    brandName: null,
    accessTokenTtlSec: 3600,
    refreshTokenTtlSec: 1209600,
    extra: null,
  });
  config.updatePolicies({
    mfa: { required: true },
    allowedIdp: { providerKeys },
  });
  return config;
}

function makePolicy(providerKeys: string[] | null): ClientAuthPolicyModel {
  return new ClientAuthPolicyModel({
    tenantId: 'tenant-1',
    clientRefId: 'client-ref-1',
    allowedAuthMethods: ['password'],
    defaultAcr: 'urn:auth:pwd',
    mfaRequired: false,
    allowedMfaMethods: ['totp'],
    maxSessionDurationSec: null,
    consentRequired: true,
    requireAuthTime: false,
    allowedIdpProviderKeys: providerKeys,
    reauthenticationIntervalSec: null,
    refreshTokenRotationEnabled: true,
    refreshTokenReuseAction: 'revoke_grant',
  });
}

function createAdapter(overrides: Record<string, unknown> = {}) {
  const provider = makeProvider();
  const registry = { get: jest.fn().mockResolvedValue(provider) };
  const clientAuthPolicyRepo = {
    findByClientRefId: jest.fn().mockResolvedValue(makePolicy(['google'])),
  };
  const clientRepo = {
    findByClientId: jest.fn().mockResolvedValue(
      (overrides.client as any) ?? {
        id: 'client-ref-1',
        enabled: true,
        secretEnc: 'encrypted-secret',
        refreshTokenTtlSec: null,
      },
    ),
  };
  const tenantConfigRepo = {
    findByTenantId: jest.fn().mockResolvedValue(makeTenantConfig(['okta'])),
  };
  const idpRepo = {
    listEnabledByTenant: jest.fn().mockResolvedValue([
      { provider: 'google', displayName: 'Google', protocol: 'oauth2' },
      { provider: 'okta', displayName: 'Okta', protocol: 'saml2' },
    ]),
    findByTenantAndProvider: jest.fn().mockResolvedValue({
      provider: 'google',
      protocol: 'oauth2',
      enabled: true,
      oauthConfig: {},
      clientId: 'google-client',
      clientSecret: 'secret',
    }),
  };
  const idpPort = {
    getAuthorizationUrl: jest.fn().mockReturnValue('https://idp.example/auth'),
  };
  const metrics = {
    incrementCounter: jest.fn(),
    observeLatency: jest.fn(),
    snapshot: jest.fn(),
  };
  const eventRepo = {
    save: jest.fn().mockResolvedValue(undefined),
  };

  return {
    adapter: new OidcInteractionAdapter(
      registry as any,
      clientAuthPolicyRepo as any,
      (overrides.clientRepo as any) ?? (clientRepo as any),
      (overrides.tenantConfigRepo as any) ?? (tenantConfigRepo as any),
      idpRepo as any,
      {} as any,
      idpPort as any,
      {} as any,
      metrics as any,
      eventRepo as any,
    ),
    provider,
    registry,
    clientAuthPolicyRepo,
    clientRepo: (overrides.clientRepo as any) ?? clientRepo,
    tenantConfigRepo,
    idpRepo,
    idpPort,
    metrics,
    eventRepo,
  };
}

function makeTokenRequest(overrides: Record<string, unknown> = {}) {
  const headers: Record<string, string> = {
    'user-agent': 'jest',
    'x-correlation-id': 'req-1',
    ...((overrides.headers as Record<string, string> | undefined) ?? {}),
  };
  return {
    url: '/t/acme/oidc/token',
    body: {
      grant_type: 'client_credentials',
      ...((overrides.body as Record<string, unknown> | undefined) ?? {}),
    },
    query: {},
    headers,
    ip: '203.0.113.10',
    tenant,
    get: jest.fn((name: string) => headers[name.toLowerCase()]),
    ...overrides,
  };
}

describe('OidcInteractionAdapter policy resolution', () => {
  it('getDetails는 client IdP override와 tenant MFA 정책을 적용한다', async () => {
    const { adapter } = createAdapter();

    const result = await adapter.getDetails({
      tenantCode: 'acme',
      uid: 'uid-1',
      req: {},
      res: {},
      tenant,
    });

    expect(result.mfaRequired).toBe(true);
    expect(result.idpList).toEqual([
      { provider: 'google', name: 'Google', protocol: 'oauth2' },
    ]);
  });

  it('허용되지 않은 IdP redirect는 거부한다', async () => {
    const { adapter } = createAdapter({
      tenantConfigRepo: {
        findByTenantId: jest.fn().mockResolvedValue(makeTenantConfig(['okta'])),
      },
    });

    const result = await adapter.getIdpRedirect({
      tenantCode: 'acme',
      uid: 'uid-1',
      providerName: 'github',
      req: {},
      res: {},
      tenant,
    });

    expect(result).toEqual({ status: 403, body: { error: 'idp_not_allowed' } });
  });

  it('token endpoint invalid_client 실패를 보안 감사 이벤트로 기록한다', async () => {
    const invalidClient = Object.assign(new Error('invalid_client'), {
      error: 'invalid_client',
    });
    const clientRepo = {
      findByClientId: jest.fn().mockResolvedValue(null),
    };
    const { adapter, provider, eventRepo, metrics } = createAdapter({
      clientRepo,
    });
    provider.callback.mockReturnValue(
      jest.fn().mockRejectedValue(invalidClient),
    );
    const req = makeTokenRequest({
      body: { grant_type: 'client_credentials', client_id: 'missing-client' },
    });

    await expect(
      adapter.delegateProviderCallback({
        tenantCode: 'acme',
        req,
        res: { statusCode: 400 },
      }),
    ).rejects.toBe(invalidClient);

    expect(metrics.incrementCounter).toHaveBeenCalledWith(
      'invalid_client_total',
      { tenantCode: 'acme' },
    );
    const event = eventRepo.save.mock.calls[0][0];
    expect(event.tenantId).toBe('tenant-1');
    expect(event.clientId).toBe('missing-client');
    expect(event.category).toBe('SECURITY');
    expect(event.action).toBe('ACCESS_DENIED');
    expect(event.resourceType).toBe('oidc-client');
    expect(event.reason).toBe('InvalidClient');
    expect(event.userAgent).toBe('jest');
    expect(event.correlationId).toBe('req-1');
  });

  it('client_secret 불일치로 추정되는 invalid_client 실패를 구분한다', async () => {
    const invalidClient = Object.assign(new Error('invalid_client'), {
      error: 'invalid_client',
    });
    const { adapter, provider, eventRepo } = createAdapter();
    provider.callback.mockReturnValue(
      jest.fn().mockRejectedValue(invalidClient),
    );
    const req = makeTokenRequest({
      headers: {
        authorization: `Basic ${Buffer.from('web-app:bad-secret').toString('base64')}`,
      },
    });

    await expect(
      adapter.delegateProviderCallback({
        tenantCode: 'acme',
        req,
        res: { statusCode: 400 },
      }),
    ).rejects.toBe(invalidClient);

    const event = eventRepo.save.mock.calls[0][0];
    expect(event.clientId).toBe('web-app');
    expect(event.reason).toBe('ClientSecretMismatch');
    expect(JSON.stringify(event.metadata)).not.toContain('bad-secret');
  });

  it('비활성 client의 token endpoint 접근을 구분한다', async () => {
    const invalidClient = Object.assign(new Error('invalid_client'), {
      error: 'invalid_client',
    });
    const { adapter, provider, eventRepo } = createAdapter({
      client: {
        id: 'client-ref-1',
        enabled: false,
        secretEnc: 'encrypted-secret',
        refreshTokenTtlSec: null,
      },
    });
    provider.callback.mockReturnValue(
      jest.fn().mockRejectedValue(invalidClient),
    );
    const req = makeTokenRequest({
      body: { grant_type: 'client_credentials', client_id: 'web-app' },
    });

    await expect(
      adapter.delegateProviderCallback({
        tenantCode: 'acme',
        req,
        res: { statusCode: 400 },
      }),
    ).rejects.toBe(invalidClient);

    const event = eventRepo.save.mock.calls[0][0];
    expect(event.clientId).toBe('web-app');
    expect(event.reason).toBe('InactiveClient');
  });
});
