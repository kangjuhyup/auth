const LOCAL_HOSTS = new Set([
  'auth-service',
  'localhost',
  '127.0.0.1',
  '[::1]',
]);
const MAX_CONTAINER_ID = 2_147_483_647;

function boundedProcessId(value, name) {
  if (!Number.isInteger(value) || value < 0 || value > MAX_CONTAINER_ID) {
    throw new TypeError(`${name} must be a bounded nonnegative integer`);
  }
  return String(value);
}

function positiveInteger(raw, name) {
  if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  return Number(raw);
}

function boundedSoakSeconds(raw) {
  if (
    !/^[1-9]\d*$/.test(raw) ||
    !Number.isSafeInteger(Number(raw)) ||
    Number(raw) > 1800
  ) {
    throw new RangeError('SOAK_SECONDS must be between 1 and 1800 seconds');
  }
  return Number(raw);
}

function enumValue(raw, values, name) {
  if (!values.includes(raw)) {
    throw new TypeError(`${name} must be one of: ${values.join(', ')}`);
  }
  return raw;
}

function randomHex(randomBytesFn, byteLength) {
  const value = randomBytesFn(byteLength);
  if (!Buffer.isBuffer(value) || value.length !== byteLength) {
    throw new TypeError(`randomBytesFn must return ${byteLength} bytes`);
  }
  return value.toString('hex');
}

export function assertLocalTarget(rawUrl, allowRemote = false) {
  const url = new URL(rawUrl);
  if (!allowRemote && !LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`Refusing non-local load-test target: ${url.hostname}`);
  }
  return url;
}

export function parseOptions(env) {
  return Object.freeze({
    maxVus: positiveInteger(env.MAX_VUS ?? '1000', 'MAX_VUS'),
    warmupSeconds: positiveInteger(
      env.WARMUP_SECONDS ?? '60',
      'WARMUP_SECONDS',
    ),
    measureSeconds: positiveInteger(
      env.MEASURE_SECONDS ?? '180',
      'MEASURE_SECONDS',
    ),
    soakSeconds: boundedSoakSeconds(env.SOAK_SECONDS ?? '1800'),
    mode: enumValue(
      env.LOAD_TEST_MODE ?? 'capacity',
      ['capacity', 'smoke'],
      'LOAD_TEST_MODE',
    ),
    allowRemoteTarget: env.ALLOW_REMOTE_TARGET === 'true',
  });
}

export function resolveLoadTestIdentity(getuid, getgid) {
  const identity = {};
  if (typeof getuid === 'function') {
    identity.LOAD_TEST_UID = boundedProcessId(getuid(), 'process UID');
  }
  if (typeof getgid === 'function') {
    identity.LOAD_TEST_GID = boundedProcessId(getgid(), 'process GID');
  }
  return identity;
}

export function createRuntimeEnvironment(options, randomBytesFn) {
  const runtimeValues = {
    ADMIN_PASSWORD: randomHex(randomBytesFn, 32),
    DB_PASSWORD: randomHex(randomBytesFn, 32),
    LOAD_USER_PASSWORD: randomHex(randomBytesFn, 32),
    JWKS_ENCRYPTION_KEY: randomHex(randomBytesFn, 32),
    OTP_TOKEN_SECRET: randomHex(randomBytesFn, 32),
    OIDC_COOKIE_KEYS: `${randomHex(randomBytesFn, 32)},${randomHex(randomBytesFn, 32)}`,
    SERVICE_CLIENT_SECRET: randomHex(randomBytesFn, 48),
  };

  return {
    text: `${Object.entries(runtimeValues)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')}\n`,
    safe: {
      maxVus: options.maxVus,
      warmupSeconds: options.warmupSeconds,
      measureSeconds: options.measureSeconds,
      soakSeconds: options.soakSeconds,
      mode: options.mode,
    },
  };
}
