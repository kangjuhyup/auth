import assert from 'node:assert/strict';
import test from 'node:test';
import {
  offlineAccessScopePayload,
  publicClientPayload,
  serviceClientPayload,
  signupPayload,
  tenantPayload,
  userNameFor,
} from '../k6/payloads.js';
import { loadConfig, loadScenarioConfig } from '../k6/config.js';

const environment = {
  BASE_URL: 'http://auth-service:3000',
  ADMIN_USERNAME: 'loadtest-admin',
  ADMIN_PASSWORD: 'synthetic-admin-password',
  LOAD_USER_PASSWORD: 'synthetic-load-user-password',
  SERVICE_CLIENT_SECRET: 'synthetic-service-client-secret',
  MAX_VUS: '1000',
};

const config = loadConfig(environment);

test('loadConfig accepts only the dedicated local target and required runtime material', () => {
  assert.deepEqual(config, {
    baseUrl: 'http://auth-service:3000',
    tenantCode: 'loadtest-acme',
    adminUsername: 'loadtest-admin',
    adminPassword: 'synthetic-admin-password',
    loadUserPassword: 'synthetic-load-user-password',
    serviceClientSecret: 'synthetic-service-client-secret',
    maxVus: 1000,
  });
  assert.throws(
    () => loadConfig({ ...environment, BASE_URL: 'https://example.test' }),
    /Refusing non-local load-test target: example\.test/,
  );
  assert.throws(
    () => loadConfig({ ...environment, ADMIN_PASSWORD: '' }),
    /ADMIN_PASSWORD is required/,
  );
});

test('loadConfig rejects every missing secret without echoing its value', () => {
  for (const name of ['ADMIN_PASSWORD', 'LOAD_USER_PASSWORD', 'SERVICE_CLIENT_SECRET']) {
    let error;
    try {
      loadConfig({ ...environment, [name]: '' });
    } catch (caught) {
      error = caught;
    }
    assert.ok(error instanceof Error);
    assert.match(error.message, new RegExp(`${name} is required`));
    assert.doesNotMatch(error.message, /synthetic-/);
  }
});

test('loadConfig validates a local target without Node URL globals', () => {
  const originalUrl = globalThis.URL;
  try {
    globalThis.URL = undefined;
    assert.equal(loadConfig(environment).baseUrl, 'http://auth-service:3000');
  } finally {
    globalThis.URL = originalUrl;
  }
});

test('loadScenarioConfig permits only bounded runner controls and result paths', () => {
  assert.deepEqual(
    loadScenarioConfig({
      VUS: '7',
      WARMUP_SECONDS: '2',
      MEASURE_SECONDS: '3',
      RUN_KIND: 'soak',
      SOAK_SECONDS: '61',
      SUMMARY_PATH: '/results/soak-7.json',
    }),
    {
      vus: 7,
      warmupSeconds: 2,
      measureSeconds: 3,
      runKind: 'soak',
      soakSeconds: 61,
      summaryPath: '/results/soak-7.json',
    },
  );
  assert.throws(
    () => loadScenarioConfig({ ...environment, VUS: '0', SUMMARY_PATH: '/results/probe.json' }),
    /VUS must be a positive integer/,
  );
  assert.throws(
    () => loadScenarioConfig({ ...environment, RUN_KIND: 'capacity', SUMMARY_PATH: '/results/probe.json' }),
    /RUN_KIND must be one of: probe, smoke, soak/,
  );
  assert.throws(
    () => loadScenarioConfig({ ...environment, SUMMARY_PATH: '/tmp/secret.json' }),
    /SUMMARY_PATH must be a safe result path/,
  );
});

test('tenant payload opens an isolated load-test tenant without phone verification', () => {
  assert.deepEqual(tenantPayload(), {
    code: 'loadtest-acme',
    name: 'Load Test Acme',
    signupPolicy: 'open',
    requirePhoneVerify: false,
  });
});

test('public client enables refresh with provider-owned PKCE flow', () => {
  assert.deepEqual(publicClientPayload(config), {
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
    allowedResources: ['https://resource.loadtest.local'],
    skipConsent: true,
  });
});

test('service client can introspect only the load-test resource', () => {
  assert.deepEqual(serviceClientPayload(config), {
    clientId: 'loadtest-resource-server',
    name: 'Load Test Resource Server',
    type: 'service',
    secret: 'synthetic-service-client-secret',
    redirectUris: [],
    grantTypes: ['client_credentials'],
    responseTypes: [],
    tokenEndpointAuthMethod: 'client_secret_basic',
    scope: 'openid profile email',
    postLogoutRedirectUris: [],
    applicationType: 'web',
    allowedResources: ['https://resource.loadtest.local'],
    introspectionResources: ['https://resource.loadtest.local'],
    skipConsent: true,
  });
});

test('refresh-token scope is provisioned explicitly', () => {
  assert.deepEqual(offlineAccessScopePayload(), {
    name: 'offline_access',
    displayName: 'Offline access',
    claimKeys: [],
    enabled: true,
  });
});

test('each VU gets a stable unique user name', () => {
  assert.equal(userNameFor(1), 'loadtest-user-0001');
  assert.equal(userNameFor(1000), 'loadtest-user-1000');
});

test('signup payload ties each stable user name to the generated runtime password', () => {
  assert.deepEqual(signupPayload(1, config), {
    username: 'loadtest-user-0001',
    password: 'synthetic-load-user-password',
  });
});
