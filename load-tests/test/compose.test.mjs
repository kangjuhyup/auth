import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const syntheticLocalSecrets = {
  DB_PASSWORD: 'local-test-db-password',
  OIDC_COOKIE_KEYS: 'local-test-cookie-key-1,local-test-cookie-key-2',
  JWKS_ENCRYPTION_KEY: 'local-test-jwks-encryption-key',
  OTP_TOKEN_SECRET: 'local-test-otp-token-secret',
  ADMIN_PASSWORD: 'local-test-admin-password',
  LOAD_USER_PASSWORD: 'local-test-user-password',
  SERVICE_CLIENT_SECRET: 'local-test-service-client-secret',
  LOAD_TEST_UID: '12345',
  LOAD_TEST_GID: '23456',
};

function renderComposeConfig({ remote = false } = {}) {
  const composeFiles = ['-f', 'docker-compose.load.yml'];
  if (remote) {
    composeFiles.push('-f', 'docker-compose.remote-load.yml');
  }

  const environment = {
    ...process.env,
    ...syntheticLocalSecrets,
  };
  delete environment.LOAD_GATEWAY_BIND_IP;
  delete environment.LOAD_OIDC_ISSUER;
  delete environment.OIDC_TRUST_PROXY;
  if (remote) {
    environment.LOAD_GATEWAY_BIND_IP = '0.0.0.0';
    environment.LOAD_OIDC_ISSUER = 'https://attacker.example';
    environment.OIDC_TRUST_PROXY = 'false';
  }

  const result = spawnSync(
    'docker',
    [
      'compose',
      ...composeFiles,
      '--env-file',
      'load-tests/.env.load.example',
      'config',
      '--format',
      'json',
    ],
    {
      cwd: new URL('../..', import.meta.url),
      encoding: 'utf8',
      env: environment,
    },
  );

  assert.equal(
    result.status,
    0,
    'Docker Compose config rendering should succeed',
  );
  return JSON.parse(result.stdout);
}

test('renders an isolated single-replica load topology', () => {
  const config = renderComposeConfig();

  assert.deepEqual(Object.keys(config.services).sort(), [
    'auth-service',
    'k6',
    'postgres-load',
    'redis-load',
  ]);
  assert.equal(config.services['auth-service'].deploy?.replicas ?? 1, 1);
  assert.deepEqual(
    config.services['auth-service'].depends_on['postgres-load'].condition,
    'service_healthy',
  );
  assert.deepEqual(
    config.services['auth-service'].depends_on['redis-load'].condition,
    'service_healthy',
  );
  assert.equal(config.services.k6.image, 'grafana/k6:2.2.0');
  assert.equal(config.services.k6.user, '12345:23456');
  assert.equal(
    config.services['auth-service'].environment.OIDC_ISSUER,
    'http://auth-service:3000',
  );
  assert.match(JSON.stringify(config.services), /auth-load/);

  assert.deepEqual(Object.keys(config.volumes).sort(), [
    'auth-load-postgres',
    'auth-load-redis',
  ]);
  assert.deepEqual(Object.keys(config.networks), ['auth-load']);

  const storageMounts = [
    ...config.services['postgres-load'].volumes,
    ...config.services['redis-load'].volumes,
  ];
  assert.deepEqual(
    storageMounts
      .map(({ source, type }) => ({ source, type }))
      .sort((a, b) => a.source.localeCompare(b.source)),
    [
      { source: 'auth-load-postgres', type: 'volume' },
      { source: 'auth-load-redis', type: 'volume' },
    ],
  );
  assert.equal(
    storageMounts.some(({ type }) => type === 'bind'),
    false,
    'load storage must not bind mount the repository normal PostgreSQL or Redis data',
  );
});

test('hostile parent environment cannot alter the remote bind or issuer', () => {
  const config = renderComposeConfig({ remote: true });
  const gateway = config.services['load-gateway'];
  const authService = config.services['auth-service'];

  assert.equal(gateway.image, 'nginx:1.28.0-alpine');
  assert.deepEqual(gateway.ports, [
    {
      mode: 'ingress',
      host_ip: '192.168.0.18',
      target: 13443,
      published: '13443',
      protocol: 'tcp',
    },
  ]);

  const certificateMounts = gateway.volumes.filter(({ target }) =>
    target.startsWith('/etc/nginx/tls/'),
  );
  assert.deepEqual(certificateMounts.map(({ target }) => target).sort(), [
    '/etc/nginx/tls/client-ca.crt',
    '/etc/nginx/tls/server.crt',
    '/etc/nginx/tls/server.key',
  ]);
  assert.equal(
    certificateMounts.every(({ read_only: readOnly }) => readOnly === true),
    true,
    'every gateway certificate mount must be read-only',
  );
  assert.equal(
    gateway.volumes.find(({ target }) => target === '/etc/nginx/nginx.conf')
      .read_only,
    true,
    'the gateway configuration mount must be read-only',
  );

  assert.deepEqual(authService.ports, [
    {
      mode: 'ingress',
      host_ip: '127.0.0.1',
      target: 3000,
      published: '13000',
      protocol: 'tcp',
    },
  ]);
  assert.equal(
    authService.environment.OIDC_ISSUER,
    'https://auth-service:13443',
  );
  assert.equal(authService.environment.HTTP_TRUST_PROXY_HOPS, '1');
  assert.equal(authService.environment.OIDC_TRUST_PROXY, 'true');
});
