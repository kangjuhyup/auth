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
    findByClientId: jest.fn().mockResolvedValue({
      id: 'client-ref-1',
      refreshTokenTtlSec: null,
    }),
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

  return {
    adapter: new OidcInteractionAdapter(
      registry as any,
      clientAuthPolicyRepo as any,
      clientRepo as any,
      (overrides.tenantConfigRepo as any) ?? (tenantConfigRepo as any),
      idpRepo as any,
      {} as any,
      idpPort as any,
      {} as any,
    ),
    provider,
    registry,
    clientAuthPolicyRepo,
    clientRepo,
    tenantConfigRepo,
    idpRepo,
    idpPort,
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
});
