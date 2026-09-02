import { Counter, Rate, Trend } from 'k6/metrics';
import { safeSummaryPath } from './config.js';

export const ENDPOINT_METRICS = Object.freeze({
  login: 'load_login_duration_ms',
  introspection: 'load_introspection_duration_ms',
  userinfo: 'load_userinfo_duration_ms',
  refresh: 'load_refresh_duration_ms',
  discovery: 'load_discovery_duration_ms',
  jwks: 'load_jwks_duration_ms',
  revoke: 'load_revoke_duration_ms',
});

const METRIC_ENDPOINTS = new Set(Object.keys(ENDPOINT_METRICS));
const SOAK_MAX_SECONDS = 1800;
const SOAK_MINUTE_SECONDS = 60;
const MAX_EPOCH_MS = 8_640_000_000_000_000;

export const requestFailed = new Rate('load_request_failed');
export const checkFailed = new Rate('load_check_failed');
export const requestDuration = new Trend('load_http_req_duration_ms');
export const requestCount = new Counter('load_requests');
export const completedLoginFlows = new Counter('load_completed_login_flows');
export const measurementEpoch = new Trend('load_measurement_epoch_ms');
export const endpointDuration = Object.freeze(
  Object.fromEntries(
    Object.entries(ENDPOINT_METRICS).map(([endpoint, name]) => [
      endpoint,
      new Trend(name),
    ]),
  ),
);

function boundedSoakBucketCount(rawSeconds) {
  const seconds = Number(rawSeconds ?? '1800');
  if (
    !Number.isSafeInteger(seconds) ||
    seconds < 1 ||
    seconds > SOAK_MAX_SECONDS
  ) {
    throw new RangeError('SOAK_SECONDS must be an integer between 1 and 1800');
  }
  return Math.ceil(seconds / SOAK_MINUTE_SECONDS);
}

function boundedMinute(minute, bucketCount) {
  if (!Number.isSafeInteger(minute) || minute < 0 || minute >= bucketCount) {
    throw new RangeError(
      `soak minute must be between 0 and ${bucketCount - 1}`,
    );
  }
  return minute;
}

function measurementTags(runKind, minute) {
  if (runKind !== 'soak') return undefined;
  const bucketCount = boundedSoakBucketCount(__ENV.SOAK_SECONDS);
  const bounded = boundedMinute(minute, bucketCount);
  return { minute: String(bounded) };
}

export function recordMeasurementEpoch(epochMs) {
  if (!Number.isSafeInteger(epochMs) || epochMs < 1 || epochMs > MAX_EPOCH_MS) {
    throw new RangeError('measurement epoch must be a bounded integer');
  }
  measurementEpoch.add(epochMs);
}

function acceptedStatus(response, acceptedStatuses) {
  return (
    Array.isArray(acceptedStatuses) &&
    acceptedStatuses.includes(response.status)
  );
}

export function recordResponse({
  response,
  endpoint,
  measuring,
  acceptedStatuses,
  runKind = __ENV.RUN_KIND ?? 'probe',
  minute,
}) {
  if (!measuring) return false;
  if (!METRIC_ENDPOINTS.has(endpoint))
    throw new RangeError('unknown load-test endpoint metric');
  const tags = measurementTags(runKind ?? __ENV.RUN_KIND ?? 'probe', minute);
  const failed = !acceptedStatus(response, acceptedStatuses);
  requestFailed.add(failed, tags);
  requestDuration.add(response.timings.duration, tags);
  endpointDuration[endpoint].add(response.timings.duration, tags);
  requestCount.add(1, tags);
  return !failed;
}

export function recordCheck(
  passed,
  measuring,
  { runKind = __ENV.RUN_KIND ?? 'probe', minute } = {},
) {
  if (!measuring) return;
  checkFailed.add(
    !passed,
    measurementTags(runKind ?? __ENV.RUN_KIND ?? 'probe', minute),
  );
}

export function recordCompletedLogin(
  measuring,
  { runKind = __ENV.RUN_KIND ?? 'probe', minute } = {},
) {
  if (!measuring) return;
  completedLoginFlows.add(
    1,
    measurementTags(runKind ?? __ENV.RUN_KIND ?? 'probe', minute),
  );
}

function buildSoakSubmetricThresholds() {
  if ((__ENV.RUN_KIND ?? 'probe') !== 'soak') return {};
  const thresholdMetricNames = [
    'load_http_req_duration_ms',
    ...Object.values(ENDPOINT_METRICS),
  ];
  const rateMetricNames = ['load_request_failed', 'load_check_failed'];
  const counterMetricNames = ['load_requests'];
  const entries = [];
  for (
    let minute = 0;
    minute < boundedSoakBucketCount(__ENV.SOAK_SECONDS);
    minute += 1
  ) {
    for (const name of thresholdMetricNames) {
      entries.push([`${name}{minute:${minute}}`, ['p(99)<1000000000']]);
    }
    for (const name of rateMetricNames) {
      entries.push([`${name}{minute:${minute}}`, ['rate<1000000000']]);
    }
    for (const name of counterMetricNames) {
      entries.push([`${name}{minute:${minute}}`, ['count>=0']]);
    }
  }
  return Object.freeze(Object.fromEntries(entries));
}

export const soakSubmetricThresholds = buildSoakSubmetricThresholds();

export function handleK6Summary(data, summaryPath) {
  safeSummaryPath(summaryPath);
  return {
    [summaryPath]: JSON.stringify(data),
  };
}
