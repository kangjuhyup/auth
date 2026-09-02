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
  'platform',
  'arch',
  'nodeVersion',
  'dockerVersion',
  'k6Version',
  'serviceImage',
  'composeProject',
  'startedAt',
]);

function finiteNumber(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function nonNegativeNumber(value) {
  const number = finiteNumber(value);
  return number >= 0 ? number : 0;
}

function metricValues(raw, name) {
  const metric = raw?.metrics?.[name];
  return metric && typeof metric === 'object' && metric.values && typeof metric.values === 'object'
    ? metric.values
    : {};
}

function durationMetric(raw, name) {
  const values = metricValues(raw, name);
  return {
    count: nonNegativeNumber(values.count),
    p95Ms: nonNegativeNumber(values['p(95)']),
    p99Ms: nonNegativeNumber(values['p(99)']),
  };
}

function rateMetric(raw, name) {
  return nonNegativeNumber(metricValues(raw, name).rate);
}

function normalizedContext(context) {
  return {
    serviceRestarted: context?.serviceRestarted === true,
    dependencyErrors: nonNegativeNumber(context?.dependencyErrors),
  };
}

function emptySummary() {
  return { metrics: {} };
}

function boundedSoakSeconds(soakSeconds) {
  if (!Number.isSafeInteger(soakSeconds) || soakSeconds < 1 || soakSeconds > 1800) {
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
    if (candidate && typeof candidate === 'object') metrics[metricName] = candidate;
  }
  return { metrics };
}

function printable(value) {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : '';
}

function safeTargetUrl(value) {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    const path = url.pathname === '/' ? '' : url.pathname;
    return `${url.origin}${path}`;
  } catch {
    return undefined;
  }
}

export function normalizeK6Summary(raw, context = {}) {
  const endpointDurations = Object.fromEntries(
    Object.entries(ENDPOINT_METRICS).map(([endpoint, metricName]) => [
      endpoint,
      durationMetric(raw, metricName),
    ]),
  );
  const total = durationMetric(raw, 'load_http_req_duration_ms');
  const normalized = normalizedContext(context);

  return {
    requestFailureRate: rateMetric(raw, 'load_request_failed'),
    checkFailureRate: rateMetric(raw, 'load_check_failed'),
    p95Ms: total.p95Ms,
    p99Ms: total.p99Ms,
    endpointDurations,
    serviceRestarted: normalized.serviceRestarted,
    dependencyErrors: normalized.dependencyErrors,
  };
}

export function normalizeSoakWindows(raw, { soakSeconds = 1800, context = {} } = {}) {
  const bucketCount = Math.ceil(boundedSoakSeconds(soakSeconds) / 60);
  return Array.from({ length: bucketCount }, (_, minute) => ({
    minute,
    metrics: normalizeK6Summary(taggedSummary(raw ?? emptySummary(), minute), context),
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
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        safe[field] = value;
      }
    }
  }
  return safe;
}

export function renderSummaryMarkdown(report) {
  const environment = sanitizeEnvironment(report?.environment);
  const metrics = report?.metrics ?? normalizeK6Summary(emptySummary());
  const slo = report?.slo ?? {};
  const verdict = report?.passed === true ? 'PASS' : 'FAIL';
  const environmentRows = Object.entries(environment)
    .map(([key, value]) => `| ${key} | ${printable(value)} |`)
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
    `| Request failure rate | < ${printable(slo.maxRequestFailureRateExclusive)} |`,
    `| Check failure rate | <= ${printable(slo.maxCheckFailureRate)} |`,
    `| p95 latency | < ${printable(slo.maxP95MsExclusive)} ms |`,
    `| p99 latency | < ${printable(slo.maxP99MsExclusive)} ms |`,
    '',
    '## Endpoint metrics',
    '',
    '| Endpoint | Count | p95 (ms) | p99 (ms) |',
    '| --- | ---: | ---: | ---: |',
    endpointRows,
    '',
    '## Violations',
    '',
    ...(verdict === 'PASS' ? ['- none'] : ['- capacity constraints violated']),
    '',
  ].join('\n');
}
