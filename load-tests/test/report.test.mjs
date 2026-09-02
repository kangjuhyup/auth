import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeK6Summary,
  normalizeSoakWindows,
  renderSummaryMarkdown,
  sanitizeEnvironment,
} from '../lib/report.mjs';

const fixtureSecret = 'fixture-secret-must-never-appear';

function trend(count, p95, p99) {
  return { values: { count, 'p(95)': p95, 'p(99)': p99 } };
}

function summary(metrics) {
  return { metrics };
}

function completeMetrics() {
  return {
    load_request_failed: { values: { rate: 0.01, count: 2 } },
    load_check_failed: { values: { rate: 0, count: 0 } },
    load_http_req_duration_ms: trend(200, 125, 250),
    load_login_duration_ms: trend(30, 101, 201),
    load_introspection_duration_ms: trend(31, 102, 202),
    load_userinfo_duration_ms: trend(32, 103, 203),
    load_refresh_duration_ms: trend(33, 104, 204),
    load_discovery_duration_ms: trend(34, 105, 205),
    load_jwks_duration_ms: trend(35, 106, 206),
    load_revoke_duration_ms: trend(36, 107, 207),
    http_req_duration: trend(9999, 1, 2),
  };
}

test('normalizeK6Summary reads only the named k6 v2 custom metrics', () => {
  const metrics = normalizeK6Summary(summary(completeMetrics()), {
    serviceRestarted: true,
    dependencyErrors: 2,
  });

  assert.deepEqual(metrics, {
    requestFailureRate: 0.01,
    checkFailureRate: 0,
    p95Ms: 125,
    p99Ms: 250,
    endpointDurations: {
      login: { count: 30, p95Ms: 101, p99Ms: 201 },
      introspection: { count: 31, p95Ms: 102, p99Ms: 202 },
      userinfo: { count: 32, p95Ms: 103, p99Ms: 203 },
      refresh: { count: 33, p95Ms: 104, p99Ms: 204 },
      discovery: { count: 34, p95Ms: 105, p99Ms: 205 },
      jwks: { count: 35, p95Ms: 106, p99Ms: 206 },
      revoke: { count: 36, p95Ms: 107, p99Ms: 207 },
    },
    serviceRestarted: true,
    dependencyErrors: 2,
  });
});

test('normalizeK6Summary rejects missing required aggregate SLO metrics', () => {
  const metrics = completeMetrics();
  delete metrics.load_request_failed;
  assert.throws(
    () => normalizeK6Summary(summary(metrics)),
    /Missing required metric: load_request_failed/,
  );
});

test('normalizeK6Summary rejects malformed aggregate metrics and dependency errors', () => {
  const malformedLatency = completeMetrics();
  malformedLatency.load_http_req_duration_ms.values['p(95)'] = '125';
  assert.throws(
    () => normalizeK6Summary(summary(malformedLatency)),
    /Invalid load_http_req_duration_ms p\(95\)/,
  );
  assert.throws(
    () => normalizeK6Summary(summary(completeMetrics()), { dependencyErrors: '2' }),
    /dependencyErrors must be a non-negative safe integer/,
  );
});

test('normalizeSoakWindows creates ceil(soak seconds / 60) ordered zero-count buckets', () => {
  const raw = summary({
    'load_request_failed{minute:0}': { values: { rate: 0.01, count: 1 } },
    'load_check_failed{minute:0}': { values: { rate: 0, count: 0 } },
    'load_http_req_duration_ms{minute:0}': trend(2, 111, 222),
    'load_login_duration_ms{minute:0}': trend(1, 1, 2),
  });
  const windows = normalizeSoakWindows(raw, { soakSeconds: 61 });

  assert.equal(windows.length, 2);
  assert.deepEqual(windows[0], {
    minute: 0,
    metrics: {
      requestFailureRate: 0.01,
      checkFailureRate: 0,
      p95Ms: 111,
      p99Ms: 222,
      endpointDurations: {
        login: { count: 1, p95Ms: 1, p99Ms: 2 },
        introspection: { count: 0, p95Ms: 0, p99Ms: 0 },
        userinfo: { count: 0, p95Ms: 0, p99Ms: 0 },
        refresh: { count: 0, p95Ms: 0, p99Ms: 0 },
        discovery: { count: 0, p95Ms: 0, p99Ms: 0 },
        jwks: { count: 0, p95Ms: 0, p99Ms: 0 },
        revoke: { count: 0, p95Ms: 0, p99Ms: 0 },
      },
      serviceRestarted: false,
      dependencyErrors: 0,
    },
  });
  assert.equal(windows[1].minute, 1);
  assert.equal(windows[1].metrics.endpointDurations.login.count, 0);
  assert.equal(windows[1].metrics.requestFailureRate, 0);
});

test('normalizeSoakWindows rejects non-integer and out-of-range recognized minute tags', () => {
  assert.throws(
    () => normalizeSoakWindows(summary({
      'load_request_failed{minute:1.5}': { values: { rate: 1, count: 1 } },
    }), { soakSeconds: 61 }),
    /Invalid soak minute tag: 1\.5/,
  );
  assert.throws(
    () => normalizeSoakWindows(summary({
      'load_login_duration_ms{minute:2}': trend(1, 1, 2),
    }), { soakSeconds: 61 }),
    /Soak minute tag out of range: 2/,
  );
});

test('sanitizeEnvironment constructs a fresh allowlisted object', () => {
  const source = {
    maxVus: 50,
    warmupSeconds: 60,
    measureSeconds: 180,
    soakSeconds: 1800,
    mode: 'capacity',
    target: 'http://auth-service:3000',
    targetUrl: `http://user:${fixtureSecret}@auth-service:3000/health?access_token=${fixtureSecret}`,
    platform: `linux\n| ${fixtureSecret}`,
    serviceImage: fixtureSecret,
    ADMIN_PASSWORD: fixtureSecret,
    SERVICE_CLIENT_SECRET: fixtureSecret,
    access_token: fixtureSecret,
    arbitraryUnknown: fixtureSecret,
    nested: { authorization: `Bearer ${fixtureSecret}` },
  };
  const safe = sanitizeEnvironment(source);

  assert.deepEqual(safe, {
    maxVus: 50,
    warmupSeconds: 60,
    measureSeconds: 180,
    soakSeconds: 1800,
    mode: 'capacity',
    target: 'http://auth-service:3000',
    targetUrl: 'http://auth-service:3000/health',
  });
  assert.notEqual(safe, source);
  assert.doesNotMatch(JSON.stringify(safe), new RegExp(fixtureSecret));
});

test('renderSummaryMarkdown includes verdict, duration, SLOs, endpoints, and no secret', () => {
  const markdown = renderSummaryMarkdown({
    passed: true,
    environment: {
      maxVus: 50,
      soakSeconds: 61,
      ADMIN_PASSWORD: fixtureSecret,
    },
    slo: {
      maxRequestFailureRateExclusive: `0.01 |\n${fixtureSecret}`,
      maxCheckFailureRate: 0,
      maxP95MsExclusive: 1000,
      maxP99MsExclusive: 2000,
    },
    metrics: normalizeK6Summary(summary(completeMetrics())),
    violations: [fixtureSecret],
    firstViolationMinute: null,
  });

  assert.match(markdown, /\[PASS\]/);
  assert.match(markdown, /Soak duration: 61 seconds/);
  assert.match(markdown, /\| SLO \| Limit \|/);
  assert.match(markdown, /\| Endpoint \| Count \| p95 \(ms\) \| p99 \(ms\) \|/);
  assert.match(markdown, /\| login \| 30 \| 101 \| 201 \|/);
  assert.doesNotMatch(markdown, new RegExp(fixtureSecret));
  assert.doesNotMatch(markdown, /0\.01 \|/);
});
