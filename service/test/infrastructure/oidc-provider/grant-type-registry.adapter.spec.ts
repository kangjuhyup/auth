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
