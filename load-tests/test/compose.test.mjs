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

function renderComposeConfig() {
  const result = spawnSync(
    'docker',
    [
      'compose',
      '-f',
      'docker-compose.load.yml',
      '--env-file',
      'load-tests/.env.load.example',
      'config',
      '--format',
      'json',
    ],
    {
      cwd: new URL('../..', import.meta.url),
      encoding: 'utf8',
      env: { ...process.env, ...syntheticLocalSecrets },
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
