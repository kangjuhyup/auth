import { OidcGrantTypeRegistryAdapter } from '@infrastructure/oidc-provider/grant-type-registry.adapter';

describe('OidcGrantTypeRegistryAdapter', () => {
  let registry: OidcGrantTypeRegistryAdapter;

  beforeEach(() => {
    registry = new OidcGrantTypeRegistryAdapter();
  });

  it('provider가 지원하는 grant type 목록을 반환한다', async () => {
    await expect(registry.listSupportedGrantTypes()).resolves.toEqual([
      'authorization_code',
      'refresh_token',
      'client_credentials',
      'implicit',
    ]);
  });

  it('authorization_code + refresh_token public client를 허용한다', async () => {
    await expect(
      registry.validateClientGrantTypes({
        tenantId: 'tenant-1',
        clientType: 'public',
        applicationType: 'web',
        tokenEndpointAuthMethod: 'none',
        grantTypes: ['authorization_code', 'refresh_token'],
      }),
    ).resolves.toEqual([]);
  });

  it('등록되지 않은 custom grant는 거부한다', async () => {
    await expect(
      registry.validateClientGrantTypes({
        tenantId: 'tenant-1',
        clientType: 'public',
        applicationType: 'web',
        tokenEndpointAuthMethod: 'none',
        grantTypes: ['urn:auth:grant-type:magic_link'],
      }),
    ).resolves.toEqual([
      {
        grantType: 'urn:auth:grant-type:magic_link',
        reason: 'unsupported',
      },
    ]);
  });

  it('등록된 custom grant를 provider 지원 목록과 client 정책 검증에 포함한다', async () => {
    registry = new OidcGrantTypeRegistryAdapter([
      {
        grantType: 'urn:auth:grant-type:magic_link',
        displayName: 'Magic Link',
        builtIn: false,
        enabled: true,
        allowedClientTypes: ['confidential'],
        allowedApplicationTypes: ['web'],
        requiresClientAuthentication: true,
        parameters: ['magic_token', 'scope'],
        createHandler: () => jest.fn(),
      },
    ]);

    await expect(registry.listSupportedGrantTypes()).resolves.toContain(
      'urn:auth:grant-type:magic_link',
    );
    await expect(
      registry.validateClientGrantTypes({
        tenantId: 'tenant-1',
        clientType: 'confidential',
        applicationType: 'web',
        tokenEndpointAuthMethod: 'client_secret_basic',
        grantTypes: ['urn:auth:grant-type:magic_link'],
      }),
    ).resolves.toEqual([]);
  });

  it('disabled custom grant는 지원 목록에서 제외하고 client 정책 검증에서 거부한다', async () => {
    registry = new OidcGrantTypeRegistryAdapter([
      {
        grantType: 'urn:auth:grant-type:disabled',
        displayName: 'Disabled Grant',
        builtIn: false,
        enabled: false,
        allowedClientTypes: ['confidential'],
        allowedApplicationTypes: ['web'],
        requiresClientAuthentication: true,
        createHandler: () => jest.fn(),
      },
    ]);

    await expect(registry.listSupportedGrantTypes()).resolves.not.toContain(
      'urn:auth:grant-type:disabled',
    );
    await expect(
      registry.validateClientGrantTypes({
        tenantId: 'tenant-1',
        clientType: 'confidential',
        applicationType: 'web',
        tokenEndpointAuthMethod: 'client_secret_basic',
        grantTypes: ['urn:auth:grant-type:disabled'],
      }),
    ).resolves.toEqual([
      {
        grantType: 'urn:auth:grant-type:disabled',
        reason: 'disabled',
      },
    ]);
  });

  it('refresh_token만 단독으로 설정하면 authorization_code 누락을 알린다', async () => {
    await expect(
      registry.validateClientGrantTypes({
        tenantId: 'tenant-1',
        clientType: 'public',
        applicationType: 'web',
        tokenEndpointAuthMethod: 'none',
        grantTypes: ['refresh_token'],
      }),
    ).resolves.toEqual([
      {
        grantType: 'refresh_token',
        reason: 'required_grant_missing',
        requiredGrantType: 'authorization_code',
      },
    ]);
  });

  it('client_credentials는 client authentication 없이는 거부한다', async () => {
    await expect(
      registry.validateClientGrantTypes({
        tenantId: 'tenant-1',
        clientType: 'service',
        applicationType: 'web',
        tokenEndpointAuthMethod: 'none',
        grantTypes: ['client_credentials'],
      }),
    ).resolves.toEqual([
      {
        grantType: 'client_credentials',
        reason: 'client_auth_required',
      },
    ]);
  });

  it('public client에는 client_credentials를 허용하지 않는다', async () => {
    await expect(
      registry.validateClientGrantTypes({
        tenantId: 'tenant-1',
        clientType: 'public',
        applicationType: 'web',
        tokenEndpointAuthMethod: 'client_secret_basic',
        grantTypes: ['client_credentials'],
      }),
    ).resolves.toEqual([
      {
        grantType: 'client_credentials',
        reason: 'client_type_not_allowed',
      },
    ]);
  });
});
