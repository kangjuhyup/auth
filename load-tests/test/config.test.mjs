import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertLocalTarget,
  createRuntimeEnvironment,
  parseOptions,
} from '../lib/config.mjs';

test('assertLocalTarget accepts only the dedicated local hosts by default', () => {
  for (const rawUrl of [
    'http://auth-service:3000',
    'http://localhost:3000',
    'http://127.0.0.1:13000',
    'http://[::1]:3000',
  ]) {
    assert.equal(assertLocalTarget(rawUrl).href, new URL(rawUrl).href);
  }
});

test('assertLocalTarget refuses remote targets unless explicitly overridden', () => {
  assert.throws(
    () => assertLocalTarget('https://example.test'),
    /Refusing non-local load-test target: example\.test/,
  );
  assert.equal(
    assertLocalTarget('https://example.test', true).hostname,
    'example.test',
  );
});

test('parseOptions parses strict integer durations and applies documented defaults', () => {
  assert.deepEqual(parseOptions({
    MAX_VUS: '50',
    WARMUP_SECONDS: '1',
    MEASURE_SECONDS: '900',
    SOAK_SECONDS: '61',
    LOAD_TEST_MODE: 'smoke',
    ALLOW_REMOTE_TARGET: 'true',
  }), {
    maxVus: 50,
    warmupSeconds: 1,
    measureSeconds: 900,
    soakSeconds: 61,
    mode: 'smoke',
    allowRemoteTarget: true,
  });
  assert.deepEqual(parseOptions({ MAX_VUS: '50' }), {
    maxVus: 50,
    warmupSeconds: 60,
    measureSeconds: 180,
    soakSeconds: 1800,
    mode: 'capacity',
    allowRemoteTarget: false,
  });
});

test('parseOptions rejects non-integers and soak durations outside the bounded range', () => {
  assert.throws(() => parseOptions({ MAX_VUS: '1.5' }), /MAX_VUS must be a positive integer/);
  assert.throws(() => parseOptions({ WARMUP_SECONDS: '0' }), /WARMUP_SECONDS must be a positive integer/);
  assert.throws(() => parseOptions({ SOAK_SECONDS: '0' }), /SOAK_SECONDS must be between 1 and 1800 seconds/);
  assert.throws(() => parseOptions({ SOAK_SECONDS: '1801' }), /SOAK_SECONDS must be between 1 and 1800 seconds/);
  assert.throws(() => parseOptions({ SOAK_SECONDS: '1.1' }), /SOAK_SECONDS must be between 1 and 1800 seconds/);
  assert.throws(() => parseOptions({ LOAD_TEST_MODE: 'soak' }), /LOAD_TEST_MODE must be one of: capacity, smoke/);
});

test('createRuntimeEnvironment returns generated secrets only in dotenv text', () => {
  const generated = createRuntimeEnvironment(
    parseOptions({ MAX_VUS: '50' }),
    (byteLength) => Buffer.alloc(byteLength, 7),
  );

  assert.match(generated.text, /^ADMIN_PASSWORD=[0-9a-f]{64}$/m);
  assert.match(generated.text, /^DB_PASSWORD=[0-9a-f]{64}$/m);
  assert.match(generated.text, /^LOAD_USER_PASSWORD=[0-9a-f]{64}$/m);
  assert.match(generated.text, /^JWKS_ENCRYPTION_KEY=[0-9a-f]{64}$/m);
  assert.match(generated.text, /^OTP_TOKEN_SECRET=[0-9a-f]{64}$/m);
  assert.match(generated.text, /^OIDC_COOKIE_KEYS=[0-9a-f]{64},[0-9a-f]{64}$/m);
  assert.match(generated.text, /^SERVICE_CLIENT_SECRET=[0-9a-f]{96}$/m);
  assert.doesNotMatch(JSON.stringify(generated.safe), /07070707/);
  assert.deepEqual(generated.safe, {
    maxVus: 50,
    warmupSeconds: 60,
    measureSeconds: 180,
    soakSeconds: 1800,
    mode: 'capacity',
  });
});

test('createRuntimeEnvironment rejects entropy values with a wrong requested length', () => {
  assert.throws(
    () => createRuntimeEnvironment(parseOptions({ MAX_VUS: '50' }), () => Buffer.alloc(32, 7)),
    /randomBytesFn must return 48 bytes/,
  );
});
