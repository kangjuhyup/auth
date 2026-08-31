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

  it('생성 시 introspection resource 배열을 복사한다', () => {
    const introspectionResources = ['https://api.example.com'];
    const client = new ClientModel({ ...base, introspectionResources });

    introspectionResources.push('https://billing.example.com');

    expect(client.introspectionResources).toEqual(['https://api.example.com']);
  });

  it('introspection resource 변경 시 중복을 제거하고 입력 순서를 유지한다', () => {
    const client = new ClientModel(base);

    client.changeIntrospectionResources([
      'https://billing.example.com',
      'https://api.example.com',
      'https://billing.example.com',
      'https://orders.example.com',
      'https://api.example.com',
    ]);

    expect(client.introspectionResources).toEqual([
      'https://billing.example.com',
      'https://api.example.com',
      'https://orders.example.com',
    ]);
  });
});
