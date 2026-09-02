const LOCAL_HOSTS = new Set(['auth-service', 'localhost', '127.0.0.1', '[::1]']);

function requiredValue(env, name) {
  const value = env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is required`);
  }
  return value;
}

function positiveInteger(value, name) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error(`${name} must be a positive integer`);
  }
  return Number(value);
}

function boundedSoakSeconds(value) {
  const seconds = positiveInteger(value, 'SOAK_SECONDS');
  if (seconds > 1800) {
    throw new Error('SOAK_SECONDS must be between 1 and 1800 seconds');
  }
  return seconds;
}

function summaryPath(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^\/results\/[A-Za-z0-9][A-Za-z0-9._-]*\.json$/.test(value)) {
    throw new Error('SUMMARY_PATH must be a safe result path');
  }
  return value;
}

function assertLocalTarget(rawUrl) {
  const match = /^([a-z][a-z0-9+.-]*):\/\/(\[[^\]]+\]|[^/:?#]+)(?::([0-9]+))?(?:[/?#].*)?$/i.exec(rawUrl);
  if (!match) {
    throw new Error('BASE_URL must be an absolute URL');
  }
  const [, scheme, rawHost, rawPort] = match;
  const hostname = rawHost.toLowerCase();
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(`Refusing non-local load-test target: ${hostname}`);
  }
  if (rawPort && (Number(rawPort) < 1 || Number(rawPort) > 65535)) {
    throw new Error('BASE_URL must have a valid port');
  }
  return `${scheme.toLowerCase()}://${hostname}${rawPort ? `:${rawPort}` : ''}`;
}

export function loadConfig(env) {
  const baseUrl = assertLocalTarget(env.BASE_URL ?? 'http://auth-service:3000');

  return Object.freeze({
    baseUrl,
    tenantCode: 'loadtest-acme',
    adminUsername: requiredValue(env, 'ADMIN_USERNAME'),
    adminPassword: requiredValue(env, 'ADMIN_PASSWORD'),
    loadUserPassword: requiredValue(env, 'LOAD_USER_PASSWORD'),
    serviceClientSecret: requiredValue(env, 'SERVICE_CLIENT_SECRET'),
    maxVus: positiveInteger(env.MAX_VUS ?? '1000', 'MAX_VUS'),
  });
}

export function loadScenarioConfig(env, defaultRunKind = 'probe') {
  const runKind = env.RUN_KIND ?? defaultRunKind;
  if (!['probe', 'smoke', 'soak'].includes(runKind)) {
    throw new Error('RUN_KIND must be one of: probe, smoke, soak');
  }

  return Object.freeze({
    vus: positiveInteger(env.VUS ?? '1', 'VUS'),
    warmupSeconds: positiveInteger(env.WARMUP_SECONDS ?? '60', 'WARMUP_SECONDS'),
    measureSeconds: positiveInteger(env.MEASURE_SECONDS ?? '180', 'MEASURE_SECONDS'),
    runKind,
    soakSeconds: boundedSoakSeconds(env.SOAK_SECONDS ?? '1800'),
    summaryPath: summaryPath(env.SUMMARY_PATH),
  });
}
