import { ClientModel } from '@domain/models/client';

const base = {
  tenantId: 'tenant-1',
  clientId: 'orders-api',
  secretEnc: 'encrypted-secret',
  name: 'Orders API',
  type: 'service' as const,
  enabled: true,
  redirectUris: [],
  grantTypes: ['client_credentials'],
  responseTypes: [],
  tokenEndpointAuthMethod: 'client_secret_basic',
  scope: 'orders:read',
  postLogoutRedirectUris: [],
  applicationType: 'web' as const,
  backchannelLogoutUri: null,
  frontchannelLogoutUri: null,
  allowedResources: [],
  skipConsent: false,
};

describe('ClientModel', () => {
  it('introspection resource allowlist를 변경한다', () => {
    const client = new ClientModel(base);
    expect(client.introspectionResources).toEqual([]);

    client.changeIntrospectionResources(['https://api.example.com']);

    expect(client.introspectionResources).toEqual(['https://api.example.com']);
  });
});
