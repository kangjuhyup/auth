import { IdentityProviderMapper } from '@infrastructure/repositories/mapper/identity-provider.mapper';
import { IdentityProviderOrmEntity } from '@infrastructure/mikro-orm/entities';
import { IdentityProviderModel } from '@domain/models/identity-provider';

describe('IdentityProviderMapper', () => {
  it('ORM 엔티티를 도메인 모델로 변환한다', () => {
    const entity = Object.assign(new IdentityProviderOrmEntity(), {
      id: 'idp-1',
      tenant: { id: 'tenant-1' },
      provider: 'google',
      protocol: 'oauth2',
      displayName: 'Google',
      clientId: 'google-client',
      clientSecret: 'secret',
      redirectUri: 'https://app.example.com/callback',
      enabled: true,
      oauthConfig: null,
      samlConfig: null,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-02'),
    });

    const domain = IdentityProviderMapper.toDomain(entity);

    expect(domain.id).toBe('idp-1');
    expect(domain.tenantId).toBe('tenant-1');
    expect(domain.provider).toBe('google');
    expect(domain.protocol).toBe('oauth2');
    expect(domain.displayName).toBe('Google');
    expect(domain.clientId).toBe('google-client');
    expect(domain.clientSecret).toBe('secret');
    expect(domain.redirectUri).toBe('https://app.example.com/callback');
    expect(domain.enabled).toBe(true);
    expect(domain.oauthConfig).toBeNull();
    expect(domain.samlConfig).toBeNull();
    expect(domain.createdAt).toEqual(new Date('2025-01-01'));
    expect(domain.updatedAt).toEqual(new Date('2025-01-02'));
  });

  it('nullable clientSecret도 null로 유지한다', () => {
    const entity = Object.assign(new IdentityProviderOrmEntity(), {
      id: 'idp-2',
      tenant: { id: 'tenant-1' },
      provider: 'apple',
      protocol: 'oauth2',
      displayName: 'Apple',
      clientId: 'apple-client',
      clientSecret: null,
      redirectUri: 'https://app.example.com/apple/callback',
      enabled: false,
      oauthConfig: null,
      samlConfig: null,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-02'),
    });

    const domain = IdentityProviderMapper.toDomain(entity);

    expect(domain.clientSecret).toBeNull();
    expect(domain.enabled).toBe(false);
  });

  it('oauth_config JSON을 도메인 oauthConfig로 매핑한다', () => {
    const oauth = {
      authorizationUrl: 'https://idp.example.com/auth',
      tokenUrl: 'https://idp.example.com/token',
      subField: 'sub',
    };
    const entity = Object.assign(new IdentityProviderOrmEntity(), {
      id: 'idp-3',
      tenant: { id: 'tenant-1' },
      provider: 'google',
      protocol: 'oauth2',
      displayName: 'Google',
      clientId: 'c',
      clientSecret: 's',
      redirectUri: 'https://app.example.com/cb',
      enabled: true,
      oauthConfig: oauth,
      samlConfig: null,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-02'),
    });

    const domain = IdentityProviderMapper.toDomain(entity);

    expect(domain.oauthConfig).toEqual(oauth);
  });

  it('saml_config JSON을 도메인 samlConfig로 매핑한다', () => {
    const saml = {
      entryPoint: 'https://okta.example.com/app/sso/saml',
      idpCerts: ['cert-1'],
    };
    const entity = Object.assign(new IdentityProviderOrmEntity(), {
      id: 'idp-4',
      tenant: { id: 'tenant-1' },
      provider: 'okta',
      protocol: 'saml2',
      displayName: 'Okta',
      clientId: 'https://auth.example.com/saml/okta/metadata',
      clientSecret: null,
      redirectUri:
        'https://auth.example.com/t/acme/interaction/saml/okta/callback',
      enabled: true,
      oauthConfig: null,
      samlConfig: saml,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-02'),
    });

    const domain = IdentityProviderMapper.toDomain(entity);

    expect(domain.protocol).toBe('saml2');
    expect(domain.samlConfig).toEqual(saml);
  });

  it('도메인 모델을 새 ORM 엔티티로 변환한다', () => {
    const model = new IdentityProviderModel({
      tenantId: 'tenant-1',
      provider: 'google',
      protocol: 'oauth2',
      displayName: 'Google',
      clientId: 'client-id',
      clientSecret: null,
      redirectUri: 'https://app.example.com/callback',
      enabled: true,
      oauthConfig: { authorizationUrl: 'https://idp.example.com/auth' },
      samlConfig: null,
    });

    const entity = IdentityProviderMapper.toOrm(model);

    expect(entity).toBeInstanceOf(IdentityProviderOrmEntity);
    expect(entity.provider).toBe('google');
    expect(entity.protocol).toBe('oauth2');
    expect(entity.displayName).toBe('Google');
    expect(entity.clientId).toBe('client-id');
    expect(entity.clientSecret).toBeUndefined();
    expect(entity.redirectUri).toBe('https://app.example.com/callback');
    expect(entity.enabled).toBe(true);
    expect(entity.oauthConfig).toEqual({
      authorizationUrl: 'https://idp.example.com/auth',
    });
    expect(entity.samlConfig).toBeUndefined();
  });

  it('기존 ORM 엔티티가 있으면 값을 갱신한다', () => {
    const existing = Object.assign(new IdentityProviderOrmEntity(), {
      provider: 'okta',
      protocol: 'oauth2',
      displayName: 'Old',
      clientId: 'old-client',
      clientSecret: 'old-secret',
      redirectUri: 'https://old.example.com/callback',
      enabled: false,
      oauthConfig: { authorizationUrl: 'https://old.example.com/auth' },
      samlConfig: undefined,
    });
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
        entryPoint: 'https://okta.example.com/sso',
        idpCerts: ['cert-1'],
      },
    });

    const entity = IdentityProviderMapper.toOrm(model, existing);

    expect(entity).toBe(existing);
    expect(entity.protocol).toBe('saml2');
    expect(entity.displayName).toBe('Okta');
    expect(entity.clientId).toBe('metadata');
    expect(entity.clientSecret).toBeUndefined();
    expect(entity.redirectUri).toBe('https://app.example.com/saml/callback');
    expect(entity.enabled).toBe(true);
    expect(entity.oauthConfig).toBeUndefined();
    expect(entity.samlConfig).toEqual({
      entryPoint: 'https://okta.example.com/sso',
      idpCerts: ['cert-1'],
    });
  });
});
