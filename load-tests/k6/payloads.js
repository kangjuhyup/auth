const RESOURCE_AUDIENCE = 'https://resource.example.test';

export function userNameFor(index) {
  if (!Number.isSafeInteger(index) || index < 1) {
    throw new RangeError('user index must be a positive safe integer');
  }
  return `loadtest-user-${String(index).padStart(4, '0')}`;
}

export function tenantPayload() {
  return {
    code: 'loadtest-acme',
    name: 'Load Test Acme',
    signupPolicy: 'open',
    requirePhoneVerify: false,
  };
}

export function offlineAccessScopePayload() {
  return {
    name: 'offline_access',
    displayName: 'Offline access',
    claimKeys: [],
    enabled: true,
  };
}

export function publicClientPayload() {
  return {
    clientId: 'loadtest-web',
    name: 'Load Test Web',
    type: 'public',
    redirectUris: ['http://localhost:18080/callback'],
    grantTypes: ['authorization_code', 'refresh_token'],
    responseTypes: ['code'],
    tokenEndpointAuthMethod: 'none',
    scope: 'openid profile email offline_access',
    postLogoutRedirectUris: ['http://localhost:18080/logout'],
    applicationType: 'web',
    allowedResources: [RESOURCE_AUDIENCE],
    skipConsent: true,
  };
}

export function serviceClientPayload(config) {
  return {
    clientId: 'loadtest-resource-server',
    name: 'Load Test Resource Server',
    type: 'service',
    secret: config.serviceClientSecret,
    redirectUris: [],
    grantTypes: ['client_credentials'],
    responseTypes: [],
    tokenEndpointAuthMethod: 'client_secret_basic',
    scope: 'openid profile email',
    postLogoutRedirectUris: [],
    applicationType: 'web',
    allowedResources: [RESOURCE_AUDIENCE],
    introspectionResources: [RESOURCE_AUDIENCE],
    skipConsent: true,
  };
}

export function signupPayload(index, config) {
  return {
    username: userNameFor(index),
    password: config.loadUserPassword,
  };
}
