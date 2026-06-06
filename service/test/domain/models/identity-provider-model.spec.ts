import { IdentityProviderModel } from '@domain/models/identity-provider';

describe('IdentityProviderModel', () => {
  it('생성자에 전달한 값을 그대로 노출한다', () => {
    const model = new IdentityProviderModel(
      {
        tenantId: 'tenant-1',
        provider: 'google',
        protocol: 'oauth2',
        displayName: 'Google',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'https://app.example.com/callback',
        enabled: true,
        oauthConfig: null,
        samlConfig: null,
      },
      'idp-1',
    );

    expect(model.id).toBe('idp-1');
    expect(model.tenantId).toBe('tenant-1');
    expect(model.provider).toBe('google');
    expect(model.protocol).toBe('oauth2');
    expect(model.displayName).toBe('Google');
    expect(model.clientId).toBe('client-id');
    expect(model.clientSecret).toBe('client-secret');
    expect(model.redirectUri).toBe('https://app.example.com/callback');
    expect(model.enabled).toBe(true);
    expect(model.oauthConfig).toBeNull();
    expect(model.samlConfig).toBeNull();
  });

  it('setPersistence로 영속성 메타데이터를 설정할 수 있다', () => {
    const model = new IdentityProviderModel({
      tenantId: 'tenant-1',
      provider: 'kakao',
      displayName: 'Kakao',
      clientId: 'client-id',
      clientSecret: null,
      redirectUri: 'https://app.example.com/kakao/callback',
      enabled: false,
      oauthConfig: null,
      samlConfig: null,
    });

    const createdAt = new Date('2025-01-01T00:00:00.000Z');
    const updatedAt = new Date('2025-01-02T00:00:00.000Z');

    model.setPersistence('idp-2', createdAt, updatedAt);

    expect(model.id).toBe('idp-2');
    expect(model.createdAt).toEqual(createdAt);
    expect(model.updatedAt).toEqual(updatedAt);
    expect(model.clientSecret).toBeNull();
    expect(model.enabled).toBe(false);
  });

  it('SAML provider는 SAML 설정을 요구한다', () => {
    expect(
      () =>
        new IdentityProviderModel({
          tenantId: 'tenant-1',
          provider: 'okta',
          protocol: 'saml2',
          displayName: 'Okta',
          clientId: 'https://auth.example.com/saml/okta/metadata',
          clientSecret: null,
          redirectUri:
            'https://auth.example.com/t/acme/interaction/saml/okta/callback',
          enabled: true,
          oauthConfig: null,
          samlConfig: null,
        }),
    ).toThrow(/samlConfig/);
  });

  it('SAML provider 설정을 노출한다', () => {
    const model = new IdentityProviderModel({
      tenantId: 'tenant-1',
      provider: 'okta',
      protocol: 'saml2',
      displayName: 'Okta',
      clientId: 'https://auth.example.com/saml/okta/metadata',
      clientSecret: null,
      redirectUri:
        'https://auth.example.com/t/acme/interaction/saml/okta/callback',
      enabled: true,
      oauthConfig: null,
      samlConfig: {
        entryPoint: 'https://okta.example.com/app/sso/saml',
        idpCerts: ['cert-1'],
        attributeMapping: { sub: 'uid', email: 'mail' },
      },
    });

    expect(model.protocol).toBe('saml2');
    expect(model.samlConfig).toEqual({
      entryPoint: 'https://okta.example.com/app/sso/saml',
      idpCerts: ['cert-1'],
      attributeMapping: { sub: 'uid', email: 'mail' },
    });
  });

  it('OAuth2 provider는 samlConfig를 포함할 수 없다', () => {
    expect(
      () =>
        new IdentityProviderModel({
          tenantId: 'tenant-1',
          provider: 'custom',
          protocol: 'oauth2',
          displayName: 'Custom',
          clientId: 'client-id',
          clientSecret: null,
          redirectUri: 'https://app.example.com/callback',
          enabled: true,
          oauthConfig: null,
          samlConfig: {
            entryPoint: 'https://idp.example.com/sso',
            idpCerts: ['cert-1'],
          },
        }),
    ).toThrow(/cannot include samlConfig/);
  });

  it('SAML provider는 oauthConfig를 포함할 수 없다', () => {
    expect(
      () =>
        new IdentityProviderModel({
          tenantId: 'tenant-1',
          provider: 'okta',
          protocol: 'saml2',
          displayName: 'Okta',
          clientId: 'metadata',
          clientSecret: null,
          redirectUri: 'https://app.example.com/saml/callback',
          enabled: true,
          oauthConfig: { authorizationUrl: 'https://idp.example.com/auth' },
          samlConfig: {
            entryPoint: 'https://idp.example.com/sso',
            idpCerts: ['cert-1'],
          },
        }),
    ).toThrow(/cannot include oauthConfig/);
  });

  it('SAML provider는 entryPoint와 idpCerts를 요구한다', () => {
    const base = {
      tenantId: 'tenant-1',
      provider: 'okta',
      protocol: 'saml2' as const,
      displayName: 'Okta',
      clientId: 'metadata',
      clientSecret: null,
      redirectUri: 'https://app.example.com/saml/callback',
      enabled: true,
      oauthConfig: null,
    };

    expect(
      () =>
        new IdentityProviderModel({
          ...base,
          samlConfig: { entryPoint: '', idpCerts: ['cert-1'] },
        }),
    ).toThrow(/entryPoint/);

    expect(
      () =>
        new IdentityProviderModel({
          ...base,
          samlConfig: {
            entryPoint: 'https://idp.example.com/sso',
            idpCerts: [],
          },
        }),
    ).toThrow(/at least one IdP certificate/);
  });

  it('변경 메서드는 설정 검증을 통과한 값만 반영한다', () => {
    const model = new IdentityProviderModel({
      tenantId: 'tenant-1',
      provider: 'google',
      displayName: 'Google',
      clientId: 'client-id',
      clientSecret: 'secret',
      redirectUri: 'https://app.example.com/callback',
      enabled: true,
      oauthConfig: null,
      samlConfig: null,
    });

    model.changeDisplayName('Google Workspace');
    model.changeClientId('client-2');
    model.changeClientSecret(null);
    model.changeRedirectUri('https://app.example.com/new-callback');
    model.setEnabled(false);
    model.changeOauthConfig({
      authorizationUrl: 'https://idp.example.com/auth',
      tokenUrl: 'https://idp.example.com/token',
    });

    expect(model.displayName).toBe('Google Workspace');
    expect(model.clientId).toBe('client-2');
    expect(model.clientSecret).toBeNull();
    expect(model.redirectUri).toBe('https://app.example.com/new-callback');
    expect(model.enabled).toBe(false);
    expect(model.oauthConfig).toEqual({
      authorizationUrl: 'https://idp.example.com/auth',
      tokenUrl: 'https://idp.example.com/token',
    });
  });

  it('configureProtocol로 SAML과 OAuth2 설정을 전환한다', () => {
    const model = new IdentityProviderModel({
      tenantId: 'tenant-1',
      provider: 'okta',
      protocol: 'saml2',
      displayName: 'Okta',
      clientId: 'metadata',
      clientSecret: null,
      redirectUri: 'https://app.example.com/saml/callback',
      enabled: true,
      oauthConfig: null,
      samlConfig: {
        entryPoint: 'https://idp.example.com/sso',
        idpCerts: ['cert-1'],
      },
    });

    model.configureProtocol({
      protocol: 'oauth2',
      oauthConfig: { authorizationUrl: 'https://idp.example.com/auth' },
      samlConfig: null,
    });

    expect(model.protocol).toBe('oauth2');
    expect(model.oauthConfig).toEqual({
      authorizationUrl: 'https://idp.example.com/auth',
    });
    expect(model.samlConfig).toBeNull();
  });
});
