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
