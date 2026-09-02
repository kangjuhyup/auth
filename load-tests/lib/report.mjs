import { URL } from 'node:url';
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

const SAFE_ENVIRONMENT_FIELDS = Object.freeze([
  'maxVus',
  'warmupSeconds',
  'measureSeconds',
  'soakSeconds',
  'mode',
  'target',
  'targetUrl',
]);

const REQUIRED_AGGREGATE_METRICS = Object.freeze([
  'load_request_failed',
  'load_check_failed',
  'load_http_req_duration_ms',
]);

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
  const values = metricValues(raw, name, {
    allowMissing: !required || allowMissing,
  });
  if (values === undefined) return { count: 0, p95Ms: 0, p99Ms: 0 };
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
  return {
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

function taggedMetricName(metricName, minute) {
  return `${metricName}{minute:${minute}}`;
}

function taggedSummary(raw, minute) {
  const metrics = {};
  for (const metricName of [
    'load_request_failed',
    'load_check_failed',
    'load_http_req_duration_ms',
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

function safeTargetUrl(value) {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    const path =
      /^\/[A-Za-z0-9._~/-]*$/.test(url.pathname) && url.pathname !== '/'
        ? url.pathname
        : '';
    return `${url.origin}${path}`;
  } catch {
    return undefined;
  }
}

function safePositiveInteger(value, { max = Number.MAX_SAFE_INTEGER } = {}) {
  return Number.isSafeInteger(value) && value >= 1 && value <= max
    ? value
    : undefined;
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
    p95Ms: total.p95Ms,
    p99Ms: total.p99Ms,
    endpointDurations,
    serviceRestarted: normalized.serviceRestarted,
    dependencyErrors: normalized.dependencyErrors,
  };
}

export function normalizeSoakWindows(
  raw,
  { soakSeconds = 1800, context = {} } = {},
) {
  const bucketCount = Math.ceil(boundedSoakSeconds(soakSeconds) / 60);
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
  const safe = {};
  for (const field of SAFE_ENVIRONMENT_FIELDS) {
    if (Object.hasOwn(input ?? {}, field)) {
      const value = input[field];
      if (field === 'target' || field === 'targetUrl') {
        const target = safeTargetUrl(value);
        if (target !== undefined) safe[field] = target;
        continue;
      }
      if (field === 'mode' && (value === 'capacity' || value === 'smoke')) {
        safe[field] = value;
        continue;
      }
      const maximum = field === 'soakSeconds' ? 1800 : Number.MAX_SAFE_INTEGER;
      const integer = safePositiveInteger(value, { max: maximum });
      if (integer !== undefined) {
        safe[field] = integer;
      }
    }
  }
  return safe;
}

export function renderSummaryMarkdown(report) {
  const environment = sanitizeEnvironment(report?.environment);
  const metrics = safeCapacityMetrics(
    report?.metrics ?? emptyCapacityMetrics(),
  );
  const slo = safeSlo(report?.slo);
  const verdict = report?.passed === true ? 'PASS' : 'FAIL';
  const environmentRows = Object.entries(environment)
    .map(([key, value]) => `| ${key} | ${value} |`)
    .join('\n');
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
    environmentRows || '| none | |',
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
    `| Overall p95 (ms) | ${metrics.p95Ms} |`,
    `| Overall p99 (ms) | ${metrics.p99Ms} |`,
    `| Service restarted | ${metrics.serviceRestarted ? 'yes' : 'no'} |`,
    `| Dependency errors | ${metrics.dependencyErrors} |`,
    '',
    '## Endpoint metrics',
    '',
    '| Endpoint | Count | p95 (ms) | p99 (ms) |',
    '| --- | ---: | ---: | ---: |',
    endpointRows,
    '',
    '## Violations',
    '',
    ...(violations.length > 0
      ? violations.map((violation) => `- ${violation}`)
      : ['- none']),
    '',
  ].join('\n');
}
