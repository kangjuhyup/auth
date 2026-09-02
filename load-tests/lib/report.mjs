import { evaluateCapacityMetrics } from './capacity.mjs';

export const ENDPOINT_METRICS = Object.freeze({
  login: 'load_login_duration_ms',
  introspection: 'load_introspection_duration_ms',
  userinfo: 'load_userinfo_duration_ms',
  refresh: 'load_refresh_duration_ms',
  discovery: 'load_discovery_duration_ms',
  jwks: 'load_jwks_duration_ms',
  revoke: 'load_revoke_duration_ms',
});

const REQUIRED_AGGREGATE_METRICS = Object.freeze([
  'load_request_failed',
  'load_check_failed',
  'load_http_req_duration_ms',
  'load_requests',
]);
const MEASUREMENT_EPOCH_METRIC = 'load_measurement_epoch_ms';
const MAX_EPOCH_MS = 8_640_000_000_000_000;
const K6_IMAGE = 'grafana/k6:2.2.0';
const SERVICE_IMAGE_PATTERN = /^sha256:[a-f0-9]{64}$/;
const CONTAINER_ID_PATTERN = /^[a-f0-9]{64}$/;
const VERSION_PATTERN = /^v?\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?$/;
const HOST_OS = new Set([
  'aix',
  'android',
  'darwin',
  'freebsd',
  'haiku',
  'linux',
  'netbsd',
  'openbsd',
  'sunos',
  'win32',
]);
const HOST_ARCH = new Set([
  'arm',
  'arm64',
  'ia32',
  'loong64',
  'mips',
  'mipsel',
  'ppc',
  'ppc64',
  'riscv64',
  's390',
  's390x',
  'x64',
]);
const EXPECTED_SERVICES = Object.freeze([
  'auth-service',
  'postgres-load',
  'redis-load',
]);
const SERVICE_STATUSES = new Set(['running', 'stopped', 'missing']);

function validFiniteNumber(
  value,
  { min = 0, max = Number.POSITIVE_INFINITY } = {},
) {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}

function nonNegativeNumber(value) {
  return validFiniteNumber(value) ? value : 0;
}

function nonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function metricValues(raw, name, { allowMissing = false } = {}) {
  const metric = raw?.metrics?.[name];
  if (metric === undefined) {
    if (allowMissing) return undefined;
    throw new TypeError(`Missing required metric: ${name}`);
  }
  if (
    !metric ||
    typeof metric !== 'object' ||
    !metric.values ||
    typeof metric.values !== 'object'
  ) {
    throw new TypeError(`Invalid metric: ${name}`);
  }
  return metric.values;
}

function metricNumber(
  values,
  key,
  label,
  { integer = false, min = 0, max } = {},
) {
  const value = values?.[key];
  const valid = integer
    ? Number.isSafeInteger(value) &&
      value >= min &&
      (max === undefined || value <= max)
    : validFiniteNumber(value, { min, max });
  if (!valid) throw new TypeError(`Invalid ${label}`);
  return value;
}

function durationMetric(
  raw,
  name,
  { required = false, allowMissing = false, positiveCount = false } = {},
) {
  const metric = raw?.metrics?.[name];
  const values = metricValues(raw, name, {
    allowMissing: !required || allowMissing,
  });
  if (values === undefined) return { count: 0, p95Ms: 0, p99Ms: 0 };
  if (metric.type !== 'trend' || metric.contains !== 'default') {
    throw new TypeError(`Invalid ${name} trend structure`);
  }
  return {
    count: metricNumber(values, 'count', `${name} count`, {
      integer: true,
      min: positiveCount ? 1 : 0,
    }),
    p95Ms: metricNumber(values, 'p(95)', `${name} p(95)`),
    p99Ms: metricNumber(values, 'p(99)', `${name} p(99)`),
  };
}

function rateMetric(
  raw,
  name,
  { required = false, allowMissing = false } = {},
) {
  const metric = raw?.metrics?.[name];
  const values = metricValues(raw, name, {
    allowMissing: !required || allowMissing,
  });
  if (values === undefined) return 0;
  if (metric.type !== 'rate' || metric.contains !== 'default') {
    throw new TypeError(`Invalid ${name} rate structure`);
  }
  const passes = metricNumber(values, 'passes', `${name} passes`, {
    integer: true,
  });
  const fails = metricNumber(values, 'fails', `${name} fails`, {
    integer: true,
  });
  const rate = metricNumber(values, 'rate', `${name} rate`, { max: 1 });
  const total = passes + fails;
  if (
    !Number.isSafeInteger(total) ||
    total < 1 ||
    Math.abs(rate - passes / total) > 1e-12
  ) {
    throw new TypeError(`Invalid ${name} rate structure`);
  }
  return rate;
}

function counterMetric(
  raw,
  name,
  { required = false, allowMissing = false } = {},
) {
  const metric = raw?.metrics?.[name];
  const values = metricValues(raw, name, {
    allowMissing: !required || allowMissing,
  });
  if (values === undefined) return { count: 0, rate: 0 };
  if (metric.type !== 'counter' || metric.contains !== 'default') {
    throw new TypeError(`Invalid ${name} counter structure`);
  }
  return {
    count: metricNumber(values, 'count', `${name} count`, { integer: true }),
    rate: metricNumber(values, 'rate', `${name} rate`),
  };
}

function normalizedContext(context) {
  if (!context || typeof context !== 'object')
    throw new TypeError('context must be an object');
  const serviceRestarted = context.serviceRestarted ?? false;
  if (typeof serviceRestarted !== 'boolean')
    throw new TypeError('serviceRestarted must be a boolean');
  const dependencyErrors = context.dependencyErrors ?? 0;
  if (!Number.isSafeInteger(dependencyErrors) || dependencyErrors < 0) {
    throw new TypeError('dependencyErrors must be a non-negative safe integer');
  }
  const rawStatuses = context.serviceStatuses;
  const serviceStatuses = Object.fromEntries(
    EXPECTED_SERVICES.map((service) => [service, 'running']),
  );
  if (rawStatuses !== undefined) {
    if (
      !rawStatuses ||
      typeof rawStatuses !== 'object' ||
      Array.isArray(rawStatuses) ||
      Object.keys(rawStatuses).length !== EXPECTED_SERVICES.length
    ) {
      throw new TypeError('serviceStatuses must contain every target service');
    }
    for (const service of EXPECTED_SERVICES) {
      if (!SERVICE_STATUSES.has(rawStatuses[service])) {
        throw new TypeError('serviceStatuses contains an invalid status');
      }
      serviceStatuses[service] = rawStatuses[service];
    }
  }
  return {
    serviceStatuses,
    serviceRestarted,
    dependencyErrors,
  };
}

function emptySummary() {
  return { metrics: {} };
}

function boundedSoakSeconds(soakSeconds) {
  if (
    !Number.isSafeInteger(soakSeconds) ||
    soakSeconds < 1 ||
    soakSeconds > 1800
  ) {
    throw new RangeError('soakSeconds must be an integer between 1 and 1800');
  }
  return soakSeconds;
}

export function normalizeMeasurementEpoch(raw) {
  const metric = raw?.metrics?.[MEASUREMENT_EPOCH_METRIC];
  let values;
  try {
    values = metricValues(raw, MEASUREMENT_EPOCH_METRIC);
  } catch {
    throw new TypeError('Invalid measurement epoch metric');
  }
  const keys = ['min', 'max', 'avg', 'p(95)', 'p(99)'];
  if (
    metric?.type !== 'trend' ||
    metric.contains !== 'default' ||
    metricNumber(values, 'count', 'measurement epoch metric count', {
      integer: true,
      min: 1,
      max: 1,
    }) !== 1
  ) {
    throw new TypeError('Invalid measurement epoch metric');
  }
  const epoch = metricNumber(values, 'min', 'measurement epoch metric', {
    integer: true,
    min: 1,
    max: MAX_EPOCH_MS,
  });
  for (const key of keys.slice(1)) {
    if (
      metricNumber(values, key, 'measurement epoch metric', {
        integer: true,
        min: 1,
        max: MAX_EPOCH_MS,
      }) !== epoch
    ) {
      throw new TypeError('Invalid measurement epoch metric');
    }
  }
  return epoch;
}

function taggedMetricName(metricName, minute) {
  return `${metricName}{minute:${minute}}`;
}

function taggedSummary(raw, minute) {
  const metrics = {};
  for (const metricName of [
    'load_request_failed',
    'load_check_failed',
    'load_http_req_duration_ms',
    'load_requests',
    ...Object.values(ENDPOINT_METRICS),
  ]) {
    const candidate = raw?.metrics?.[taggedMetricName(metricName, minute)];
    if (candidate && typeof candidate === 'object')
      metrics[metricName] = candidate;
  }
  return { metrics };
}

function validateSoakMetricTags(raw, bucketCount) {
  const metrics = raw?.metrics;
  if (!metrics || typeof metrics !== 'object') return;
  const knownMetrics = [
    ...REQUIRED_AGGREGATE_METRICS,
    ...Object.values(ENDPOINT_METRICS),
  ];
  for (const key of Object.keys(metrics)) {
    const metricName = knownMetrics.find((name) => key.startsWith(`${name}{`));
    if (!metricName) continue;
    const match = new RegExp(`^${metricName}\\{minute:([^}]+)\\}$`).exec(key);
    if (!match || !/^(0|[1-9]\d*)$/.test(match[1])) {
      throw new RangeError(`Invalid soak minute tag: ${match?.[1] ?? key}`);
    }
    const minute = Number(match[1]);
    if (minute >= bucketCount)
      throw new RangeError(`Soak minute tag out of range: ${minute}`);
  }
}

function safePositiveInteger(value, { max = Number.MAX_SAFE_INTEGER } = {}) {
  return Number.isSafeInteger(value) && value >= 1 && value <= max
    ? value
    : undefined;
}

function requiredPositiveInteger(value, label, options) {
  const normalized = safePositiveInteger(value, options);
  if (normalized === undefined) throw new TypeError(`Invalid ${label}`);
  return normalized;
}

function normalizedVersion(value, label) {
  if (typeof value !== 'string' || !VERSION_PATTERN.test(value)) {
    throw new TypeError(`Invalid ${label}`);
  }
  return value;
}

export function parseDockerServerVersion(stdout) {
  let value;
  try {
    value = JSON.parse(stdout);
  } catch {
    throw new TypeError('Invalid Docker server version');
  }
  return normalizedVersion(value, 'Docker server version');
}

export function parseDockerComposeVersion(stdout) {
  if (
    typeof stdout !== 'string' ||
    !/^v?\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?(?:\r?\n)?$/.test(stdout)
  ) {
    throw new TypeError('Invalid Docker Compose version');
  }
  return normalizedVersion(stdout.trim(), 'Docker Compose version');
}

export function parseServiceImageRecord(stdout) {
  if (typeof stdout !== 'string')
    throw new TypeError('Invalid service image record');
  const fields = stdout.replace(/\n$/, '').split('\t');
  if (fields.length !== 4) throw new TypeError('Invalid service image record');
  let values;
  try {
    values = fields.map((field) => JSON.parse(field));
  } catch {
    throw new TypeError('Invalid service image record');
  }
  const [containerId, serviceImage, project, service] = values;
  if (
    typeof containerId !== 'string' ||
    !CONTAINER_ID_PATTERN.test(containerId) ||
    typeof serviceImage !== 'string' ||
    !SERVICE_IMAGE_PATTERN.test(serviceImage) ||
    project !== 'auth-load' ||
    service !== 'auth-service'
  ) {
    throw new TypeError('Invalid service image record');
  }
  return { containerId, serviceImage };
}

function safeSloValue(value, { max = Number.POSITIVE_INFINITY } = {}) {
  return validFiniteNumber(value, { max }) ? String(value) : 'not recorded';
}

function safeSlo(input) {
  return {
    maxRequestFailureRateExclusive: safeSloValue(
      input?.maxRequestFailureRateExclusive,
      { max: 1 },
    ),
    maxCheckFailureRate: safeSloValue(input?.maxCheckFailureRate, { max: 1 }),
    maxP95MsExclusive: safeSloValue(input?.maxP95MsExclusive),
    maxP99MsExclusive: safeSloValue(input?.maxP99MsExclusive),
  };
}

function evaluationSlo(input) {
  const result = {};
  for (const [name, maximum] of [
    ['maxRequestFailureRateExclusive', 1],
    ['maxCheckFailureRate', 1],
    ['maxP95MsExclusive', Number.POSITIVE_INFINITY],
    ['maxP99MsExclusive', Number.POSITIVE_INFINITY],
  ]) {
    if (validFiniteNumber(input?.[name], { max: maximum })) {
      result[name] = input[name];
    }
  }
  return result;
}

function safeCapacityMetrics(input) {
  return {
    requestFailureRate: validFiniteNumber(input?.requestFailureRate, { max: 1 })
      ? input.requestFailureRate
      : 0,
    checkFailureRate: validFiniteNumber(input?.checkFailureRate, { max: 1 })
      ? input.checkFailureRate
      : 0,
    requestCount: nonNegativeSafeInteger(input?.requestCount),
    rps: nonNegativeNumber(input?.rps),
    p95Ms: nonNegativeNumber(input?.p95Ms),
    p99Ms: nonNegativeNumber(input?.p99Ms),
    endpointDurations: Object.fromEntries(
      Object.keys(ENDPOINT_METRICS).map((endpoint) => {
        const duration = input?.endpointDurations?.[endpoint];
        return [
          endpoint,
          {
            count: nonNegativeSafeInteger(duration?.count),
            p95Ms: nonNegativeNumber(duration?.p95Ms),
            p99Ms: nonNegativeNumber(duration?.p99Ms),
          },
        ];
      }),
    ),
    serviceRestarted: input?.serviceRestarted === true,
    serviceStatuses: Object.fromEntries(
      EXPECTED_SERVICES.map((service) => [
        service,
        SERVICE_STATUSES.has(input?.serviceStatuses?.[service])
          ? input.serviceStatuses[service]
          : 'missing',
      ]),
    ),
    dependencyErrors: nonNegativeSafeInteger(input?.dependencyErrors),
  };
}

function emptyCapacityMetrics() {
  return {
    endpointDurations: Object.fromEntries(
      Object.keys(ENDPOINT_METRICS).map((endpoint) => [
        endpoint,
        { count: 0, p95Ms: 0, p99Ms: 0 },
      ]),
    ),
    serviceStatuses: Object.fromEntries(
      EXPECTED_SERVICES.map((service) => [service, 'missing']),
    ),
  };
}

export function normalizeK6Summary(raw, context = {}, internal = {}) {
  const allowMissingAggregate = internal.allowMissingAggregate === true;
  const endpointDurations = Object.fromEntries(
    Object.entries(ENDPOINT_METRICS).map(([endpoint, metricName]) => [
      endpoint,
      durationMetric(raw, metricName),
    ]),
  );
  const total = durationMetric(raw, 'load_http_req_duration_ms', {
    required: true,
    allowMissing: allowMissingAggregate,
    positiveCount: !allowMissingAggregate,
  });
  const requests = counterMetric(raw, 'load_requests', {
    required: true,
    allowMissing: allowMissingAggregate,
  });
  const normalized = normalizedContext(context);

  return {
    requestFailureRate: rateMetric(raw, 'load_request_failed', {
      required: true,
      allowMissing: allowMissingAggregate,
    }),
    checkFailureRate: rateMetric(raw, 'load_check_failed', {
      required: true,
      allowMissing: allowMissingAggregate,
    }),
    requestCount: requests.count,
    rps: requests.rate,
    p95Ms: total.p95Ms,
    p99Ms: total.p99Ms,
    endpointDurations,
    serviceStatuses: normalized.serviceStatuses,
    serviceRestarted: normalized.serviceRestarted,
    dependencyErrors: normalized.dependencyErrors,
  };
}

export function normalizeSoakWindows(
  raw,
  { soakSeconds = 1800, context = {} } = {},
) {
  const bucketCount = Math.ceil(boundedSoakSeconds(soakSeconds) / 60);
  normalizeMeasurementEpoch(raw);
  validateSoakMetricTags(raw, bucketCount);
  return Array.from({ length: bucketCount }, (_, minute) => ({
    minute,
    metrics: normalizeK6Summary(
      taggedSummary(raw ?? emptySummary(), minute),
      context,
      {
        allowMissingAggregate: true,
      },
    ),
  }));
}

export function sanitizeEnvironment(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Invalid environment metadata');
  }
  const mode = input.mode;
  const host = input.host;
  const docker = input.docker;
  if (
    (mode !== 'capacity' && mode !== 'smoke') ||
    input.target !== 'http://auth-service:3000' ||
    !host ||
    typeof host !== 'object' ||
    !HOST_OS.has(host.os) ||
    !HOST_ARCH.has(host.arch) ||
    typeof host.cpuModel !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9 ._()+@/-]{0,159}$/.test(host.cpuModel) ||
    !docker ||
    typeof docker !== 'object' ||
    input.k6Image !== K6_IMAGE ||
    typeof input.serviceImage !== 'string' ||
    !SERVICE_IMAGE_PATTERN.test(input.serviceImage)
  ) {
    throw new TypeError('Invalid environment metadata');
  }
  return {
    maxVus: requiredPositiveInteger(input.maxVus, 'maxVus'),
    warmupSeconds: requiredPositiveInteger(
      input.warmupSeconds,
      'warmupSeconds',
    ),
    measureSeconds: requiredPositiveInteger(
      input.measureSeconds,
      'measureSeconds',
    ),
    soakSeconds: requiredPositiveInteger(input.soakSeconds, 'soakSeconds', {
      max: 1_800,
    }),
    mode,
    target: 'http://auth-service:3000',
    host: {
      os: host.os,
      arch: host.arch,
      cpuModel: host.cpuModel,
      cpuCount: requiredPositiveInteger(host.cpuCount, 'host CPU count', {
        max: 65_536,
      }),
      memoryBytes: requiredPositiveInteger(
        host.memoryBytes,
        'host memory bytes',
      ),
    },
    docker: {
      version: normalizedVersion(docker.version, 'Docker server version'),
      composeVersion: normalizedVersion(
        docker.composeVersion,
        'Docker Compose version',
      ),
    },
    k6Image: K6_IMAGE,
    serviceImage: input.serviceImage,
  };
}

function requiredNonNegativeNumber(value, label) {
  if (!validFiniteNumber(value)) throw new TypeError(`Invalid ${label}`);
  return value;
}

function requiredNonNegativeInteger(
  value,
  label,
  { max = Number.MAX_SAFE_INTEGER } = {},
) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max)
    throw new TypeError(`Invalid ${label}`);
  return value;
}

function normalizedTrafficMix(input) {
  const configured = Object.freeze({
    introspection: 45,
    userinfo: 25,
    refresh: 12,
    discovery: 8,
    jwks: 5,
    relogin: 5,
  });
  if (
    !input ||
    typeof input !== 'object' ||
    Object.entries(configured).some(([name, share]) => input[name] !== share)
  ) {
    throw new TypeError('Invalid traffic mix');
  }
  return configured;
}

function normalizedSecurityGate(input) {
  if (!input || typeof input !== 'object' || input.path !== '/admin/session') {
    throw new TypeError('Invalid security gate report');
  }
  return {
    path: '/admin/session',
    timeToFirst429Ms: requiredNonNegativeInteger(
      input.timeToFirst429Ms,
      'security time to first 429',
      { max: 300_000 },
    ),
    authRejectedCount: requiredNonNegativeInteger(
      input.authRejectedCount,
      'security rejected count',
    ),
    rateLimitedCount: requiredNonNegativeInteger(
      input.rateLimitedCount,
      'security rate-limited count',
    ),
    unexpectedCount: requiredNonNegativeInteger(
      input.unexpectedCount,
      'security unexpected count',
    ),
  };
}

function normalizedMonitorSummary(input) {
  if (!input || typeof input !== 'object' || !input.services) {
    throw new TypeError('Invalid monitor summary');
  }
  const services = {};
  for (const service of ['auth-service', 'postgres-load', 'redis-load']) {
    const value = input.services[service];
    if (!value || typeof value !== 'object')
      throw new TypeError('Invalid monitor summary');
    services[service] = {
      peakCpuPercent: requiredNonNegativeNumber(
        value.peakCpuPercent,
        'monitor CPU peak',
      ),
      peakMemoryUsageBytes: requiredNonNegativeInteger(
        value.peakMemoryUsageBytes,
        'monitor memory peak',
      ),
      peakNetworkInputBytes: requiredNonNegativeInteger(
        value.peakNetworkInputBytes,
        'monitor network input peak',
      ),
      peakNetworkOutputBytes: requiredNonNegativeInteger(
        value.peakNetworkOutputBytes,
        'monitor network output peak',
      ),
      maxRestartCount: requiredNonNegativeInteger(
        value.maxRestartCount,
        'monitor restart peak',
      ),
      stoppedSamples: requiredNonNegativeInteger(
        value.stoppedSamples,
        'monitor stopped samples',
      ),
      missingSamples: requiredNonNegativeInteger(
        value.missingSamples,
        'monitor missing samples',
      ),
    };
  }
  return {
    sampleCount: requiredPositiveInteger(input.sampleCount, 'monitor samples'),
    services,
    peakPostgresConnections: requiredNonNegativeInteger(
      input.peakPostgresConnections,
      'PostgreSQL connection peak',
    ),
    peakRedisConnectedClients: requiredNonNegativeInteger(
      input.peakRedisConnectedClients,
      'Redis client peak',
    ),
    peakRedisUsedMemoryBytes: requiredNonNegativeInteger(
      input.peakRedisUsedMemoryBytes,
      'Redis memory peak',
    ),
    dependencyErrors: requiredNonNegativeInteger(
      input.dependencyErrors,
      'monitor dependency errors',
    ),
  };
}

export function renderSummaryMarkdown(report) {
  const environment = sanitizeEnvironment(report?.environment);
  const trafficMix = normalizedTrafficMix(report?.trafficMix);
  const securityGate = normalizedSecurityGate(report?.securityGate);
  const monitorSummary = normalizedMonitorSummary(report?.monitorSummary);
  const metrics = safeCapacityMetrics(
    report?.metrics ?? emptyCapacityMetrics(),
  );
  const slo = safeSlo(report?.slo);
  const verdict = report?.passed === true ? 'PASS' : 'FAIL';
  const environmentRows = [
    ['maxVus', environment.maxVus],
    ['warmupSeconds', environment.warmupSeconds],
    ['measureSeconds', environment.measureSeconds],
    ['soakSeconds', environment.soakSeconds],
    ['mode', environment.mode],
    ['target', environment.target],
    ['host OS', environment.host.os],
    ['host architecture', environment.host.arch],
    ['host CPU', environment.host.cpuModel],
    ['host CPU count', environment.host.cpuCount],
    ['host memory bytes', environment.host.memoryBytes],
    ['Docker version', environment.docker.version],
    ['Compose version', environment.docker.composeVersion],
    ['k6 image', environment.k6Image],
    ['service image', environment.serviceImage],
  ].map(([key, value]) => `| ${key} | ${value} |`);
  const endpointRows = Object.entries(ENDPOINT_METRICS)
    .map(([endpoint]) => {
      const duration = metrics.endpointDurations?.[endpoint] ?? {};
      return `| ${endpoint} | ${nonNegativeNumber(duration.count)} | ${nonNegativeNumber(duration.p95Ms)} | ${nonNegativeNumber(duration.p99Ms)} |`;
    })
    .join('\n');
  const firstViolation = Number.isSafeInteger(report?.firstViolationMinute)
    ? String(report.firstViolationMinute)
    : 'none';
  const violations =
    verdict === 'PASS'
      ? []
      : evaluateCapacityMetrics(metrics, evaluationSlo(report?.slo)).violations;
  const trafficRows = Object.entries(trafficMix).map(
    ([action, share]) => `| ${action} | ${share}% |`,
  );
  const monitorRows = Object.entries(monitorSummary.services).map(
    ([service, values]) =>
      `| ${service} | ${values.peakCpuPercent} | ${values.peakMemoryUsageBytes} | ${values.peakNetworkInputBytes} | ${values.peakNetworkOutputBytes} | ${values.maxRestartCount} | ${values.stoppedSamples} | ${values.missingSamples} |`,
  );

  return [
    '# Local capacity test summary',
    '',
    `Result: [${verdict}]`,
    `Soak duration: ${nonNegativeNumber(environment.soakSeconds)} seconds`,
    `First violation minute: ${firstViolation}`,
    '',
    '## Environment',
    '',
    '| Field | Value |',
    '| --- | --- |',
    ...environmentRows,
    '',
    '## Traffic mix',
    '',
    '| Action | Share |',
    '| --- | ---: |',
    ...trafficRows,
    '',
    '## Security gate',
    '',
    '| Path | Time to first 429 (ms) | Rejected | Rate limited | Unexpected |',
    '| --- | ---: | ---: | ---: | ---: |',
    `| ${securityGate.path} | ${securityGate.timeToFirst429Ms} | ${securityGate.authRejectedCount} | ${securityGate.rateLimitedCount} | ${securityGate.unexpectedCount} |`,
    '',
    '## SLO',
    '',
    '| SLO | Limit |',
    '| --- | --- |',
    `| Request failure rate | < ${slo.maxRequestFailureRateExclusive} |`,
    `| Check failure rate | <= ${slo.maxCheckFailureRate} |`,
    `| p95 latency | < ${slo.maxP95MsExclusive} ms |`,
    `| p99 latency | < ${slo.maxP99MsExclusive} ms |`,
    '',
    '## Evaluated outcome',
    '',
    '| Metric | Value |',
    '| --- | ---: |',
    `| Request failure rate | ${metrics.requestFailureRate} |`,
    `| Check failure rate | ${metrics.checkFailureRate} |`,
    `| Request count | ${metrics.requestCount} |`,
    `| RPS | ${metrics.rps} |`,
    `| Overall p95 (ms) | ${metrics.p95Ms} |`,
    `| Overall p99 (ms) | ${metrics.p99Ms} |`,
    ...EXPECTED_SERVICES.map(
      (service) =>
        `| ${service} status | ${metrics.serviceStatuses[service]} |`,
    ),
    `| Service restarted | ${metrics.serviceRestarted ? 'yes' : 'no'} |`,
    `| Dependency errors | ${metrics.dependencyErrors} |`,
    '',
    '## Endpoint metrics',
    '',
    '| Endpoint | Count | p95 (ms) | p99 (ms) |',
    '| --- | ---: | ---: | ---: |',
    endpointRows,
    '',
    '## Monitor bottleneck evidence',
    '',
    `Samples: ${monitorSummary.sampleCount}`,
    '',
    '| Service | Peak CPU (%) | Peak memory (bytes) | Peak network in (bytes) | Peak network out (bytes) | Max restarts | Stopped samples | Missing samples |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...monitorRows,
    '',
    '| Dependency evidence | Peak/count |',
    '| --- | ---: |',
    `| PostgreSQL connections | ${monitorSummary.peakPostgresConnections} |`,
    `| Redis connected clients | ${monitorSummary.peakRedisConnectedClients} |`,
    `| Redis used memory (bytes) | ${monitorSummary.peakRedisUsedMemoryBytes} |`,
    `| Dependency errors | ${monitorSummary.dependencyErrors} |`,
    '',
    '## Violations',
    '',
    ...(violations.length > 0
      ? violations.map((violation) => `- ${violation}`)
      : ['- none']),
    '',
  ].join('\n');
}
