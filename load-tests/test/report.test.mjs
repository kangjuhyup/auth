import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveBottleneckCandidate,
  normalizeK6Summary,
  normalizeMeasurementEpoch,
  normalizeSoakWindows,
  parseDockerComposeVersion,
  parseDockerServerVersion,
  parseServiceImageRecord,
  renderSummaryMarkdown,
  sanitizeEnvironment,
} from '../lib/report.mjs';

const fixtureSecret = 'fixture-secret-must-never-appear';

function trend(count, p95, p99) {
  return {
    type: 'trend',
    contains: 'default',
    values: { count, 'p(95)': p95, 'p(99)': p99 },
  };
}

function rate(passes, fails) {
  return {
    type: 'rate',
    contains: 'default',
    values: { passes, fails, rate: passes / (passes + fails) },
  };
}

function counter(count, rateValue) {
  return {
    type: 'counter',
    contains: 'default',
    values: { count, rate: rateValue },
  };
}

function summary(metrics) {
  return { metrics };
}

function measurementEpoch(value = 1_778_000_000_000) {
  return {
    type: 'trend',
    contains: 'default',
    values: {
      count: 1,
      min: value,
      max: value,
      avg: value,
      'p(95)': value,
      'p(99)': value,
    },
  };
}

function completeMetrics() {
  return {
    load_request_failed: rate(2, 198),
    load_check_failed: rate(0, 200),
    load_http_req_duration_ms: trend(200, 125, 250),
    load_requests: counter(200, 33.25),
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
  const metrics = normalizeK6Summary(
    summary(completeMetrics()),
    {
      serviceRestarted: true,
      dependencyErrors: 2,
    },
    { measurementSeconds: 8 },
  );

  assert.deepEqual(metrics, {
    requestFailureRate: 0.01,
    checkFailureRate: 0,
    requestCount: 200,
    rps: 25,
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
    serviceStatuses: {
      'auth-service': 'running',
      'postgres-load': 'running',
      'redis-load': 'running',
    },
    serviceRestarted: true,
    dependencyErrors: 2,
  });
});

test('normalizeK6Summary derives probe RPS from count and the measured window', () => {
  const raw = completeMetrics();
  raw.load_requests = counter(111, 0.7142353962549727);

  const metrics = normalizeK6Summary(
    summary(raw),
    {},
    {
      measurementSeconds: 150,
    },
  );

  assert.equal(metrics.requestCount, 111);
  assert.equal(metrics.rps, 0.74);
});

test('normalizeK6Summary rejects an absent or invalid measured window', () => {
  for (const measurementSeconds of [
    undefined,
    0,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    Number.POSITIVE_INFINITY,
  ]) {
    assert.throws(
      () =>
        normalizeK6Summary(
          summary(completeMetrics()),
          {},
          {
            measurementSeconds,
          },
        ),
      /measurementSeconds/,
    );
  }
});

test('normalizeK6Summary rejects missing required aggregate SLO metrics', () => {
  const metrics = completeMetrics();
  delete metrics.load_request_failed;
  assert.throws(
    () => normalizeK6Summary(summary(metrics), {}, { measurementSeconds: 180 }),
    /Missing required metric: load_request_failed/,
  );
});

test('normalizeK6Summary rejects malformed aggregate metrics and dependency errors', () => {
  const malformedLatency = completeMetrics();
  malformedLatency.load_http_req_duration_ms.values['p(95)'] = '125';
  assert.throws(
    () =>
      normalizeK6Summary(
        summary(malformedLatency),
        {},
        {
          measurementSeconds: 180,
        },
      ),
    /Invalid load_http_req_duration_ms p\(95\)/,
  );
  assert.throws(
    () =>
      normalizeK6Summary(
        summary(completeMetrics()),
        { dependencyErrors: '2' },
        { measurementSeconds: 180 },
      ),
    /dependencyErrors must be a non-negative safe integer/,
  );
  assert.throws(
    () =>
      normalizeK6Summary(
        summary(completeMetrics()),
        {
          serviceStatuses: { 'auth-service': 'stopped' },
        },
        { measurementSeconds: 180 },
      ),
    /serviceStatuses/,
  );
});

test('normalizeK6Summary rejects inconsistent rates and malformed endpoint percentiles', () => {
  const inconsistentRate = completeMetrics();
  inconsistentRate.load_request_failed.values.rate = 0;
  assert.throws(
    () =>
      normalizeK6Summary(
        summary(inconsistentRate),
        {},
        {
          measurementSeconds: 180,
        },
      ),
    /Invalid load_request_failed rate structure/,
  );

  const malformedEndpoint = completeMetrics();
  malformedEndpoint.load_login_duration_ms.values['p(99)'] = Number.NaN;
  assert.throws(
    () =>
      normalizeK6Summary(
        summary(malformedEndpoint),
        {},
        {
          measurementSeconds: 180,
        },
      ),
    /Invalid load_login_duration_ms p\(99\)/,
  );

  const malformedTrend = completeMetrics();
  malformedTrend.load_http_req_duration_ms.type = 'gauge';
  assert.throws(
    () =>
      normalizeK6Summary(
        summary(malformedTrend),
        {},
        {
          measurementSeconds: 180,
        },
      ),
    /load_http_req_duration_ms trend structure/,
  );

  const malformedRequests = completeMetrics();
  malformedRequests.load_requests.values.rate = -1;
  assert.throws(
    () =>
      normalizeK6Summary(
        summary(malformedRequests),
        {},
        {
          measurementSeconds: 180,
        },
      ),
    /load_requests/,
  );
});

test('normalizeMeasurementEpoch accepts exactly one bounded integer observation', () => {
  assert.equal(
    normalizeMeasurementEpoch(
      summary({ load_measurement_epoch_ms: measurementEpoch() }),
    ),
    1_778_000_000_000,
  );
});

test('normalizeMeasurementEpoch fails closed when the epoch is absent or inconsistent', () => {
  assert.throws(() => normalizeMeasurementEpoch(summary({})), /epoch metric/);
  for (const metric of [
    {
      ...measurementEpoch(),
      values: { ...measurementEpoch().values, count: 2 },
    },
    {
      ...measurementEpoch(),
      values: { ...measurementEpoch().values, max: 1_778_000_000_001 },
    },
    {
      ...measurementEpoch(),
      values: { ...measurementEpoch().values, avg: 1.5 },
    },
    measurementEpoch(8_640_000_000_000_001),
  ]) {
    assert.throws(
      () =>
        normalizeMeasurementEpoch(
          summary({ load_measurement_epoch_ms: metric }),
        ),
      /epoch metric/,
    );
  }
});

test('normalizeSoakWindows creates ceil(soak seconds / 60) ordered zero-count buckets', () => {
  const raw = summary({
    load_measurement_epoch_ms: measurementEpoch(),
    'load_request_failed{minute:0}': rate(1, 99),
    'load_check_failed{minute:0}': rate(0, 100),
    'load_http_req_duration_ms{minute:0}': trend(2, 111, 222),
    'load_requests{minute:0}': counter(2, 0.5),
    'load_login_duration_ms{minute:0}': trend(1, 1, 2),
  });
  const windows = normalizeSoakWindows(raw, { soakSeconds: 61 });

  assert.equal(windows.length, 2);
  assert.deepEqual(windows[0], {
    minute: 0,
    measurementSeconds: 60,
    metrics: {
      requestFailureRate: 0.01,
      checkFailureRate: 0,
      requestCount: 2,
      rps: 0.03333333333333333,
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
      serviceStatuses: {
        'auth-service': 'running',
        'postgres-load': 'running',
        'redis-load': 'running',
      },
      serviceRestarted: false,
      dependencyErrors: 0,
    },
  });
  assert.equal(windows[1].minute, 1);
  assert.equal(windows[1].measurementSeconds, 1);
  assert.equal(windows[1].metrics.endpointDurations.login.count, 0);
  assert.equal(windows[1].metrics.requestFailureRate, 0);
});

test('normalizeSoakWindows derives RPS from each exact full or partial bucket', () => {
  const raw = summary({
    load_measurement_epoch_ms: measurementEpoch(),
    'load_requests{minute:0}': counter(45, 0.6380510331483288),
    'load_requests{minute:1}': counter(2, 0.028357823695481277),
  });

  const windows = normalizeSoakWindows(raw, { soakSeconds: 65 });

  assert.deepEqual(
    windows.map(({ minute, metrics }) => ({
      minute,
      requestCount: metrics.requestCount,
      rps: metrics.rps,
    })),
    [
      { minute: 0, requestCount: 45, rps: 0.75 },
      { minute: 1, requestCount: 2, rps: 0.4 },
    ],
  );
});

test('normalizeSoakWindows rejects non-integer and out-of-range recognized minute tags', () => {
  assert.throws(
    () =>
      normalizeSoakWindows(
        summary({
          load_measurement_epoch_ms: measurementEpoch(),
          'load_request_failed{minute:1.5}': rate(1, 0),
        }),
        { soakSeconds: 61 },
      ),
    /Invalid soak minute tag: 1\.5/,
  );
  assert.throws(
    () =>
      normalizeSoakWindows(
        summary({
          load_measurement_epoch_ms: measurementEpoch(),
          'load_login_duration_ms{minute:2}': trend(1, 1, 2),
        }),
        { soakSeconds: 61 },
      ),
    /Soak minute tag out of range: 2/,
  );
});

function completeEnvironment(overrides = {}) {
  return {
    maxVus: 50,
    warmupSeconds: 60,
    measureSeconds: 180,
    soakSeconds: 1800,
    mode: 'capacity',
    target: 'http://auth-service:3000',
    host: {
      os: 'darwin',
      arch: 'arm64',
      cpuModel: 'Apple M3 Pro',
      cpuCount: 12,
      memoryBytes: 36_000_000_000,
    },
    docker: { version: '28.3.3', composeVersion: '2.39.2' },
    k6Image: 'grafana/k6:2.2.0',
    serviceImage: `sha256:${'d'.repeat(64)}`,
    ...overrides,
  };
}

function evidenceWindow({
  startedAt = '2026-09-02T01:02:04.004Z',
  endedAt = '2026-09-02T01:02:09.004Z',
  authStoppedSamples = 0,
  authCpu = 70,
  redisCpu = 20,
} = {}) {
  return {
    startedAt,
    endedAt,
    monitorSummary: {
      sampleCount: 2,
      services: {
        'auth-service': {
          peakCpuPercent: authCpu,
          peakMemoryUsageBytes: 1_000,
          peakNetworkInputBytes: 2_000,
          peakNetworkOutputBytes: 3_000,
          maxRestartCount: 1,
          stoppedSamples: authStoppedSamples,
          missingSamples: 0,
          lastExitCode: authStoppedSamples > 0 ? 137 : 0,
          oomKilled: authStoppedSamples > 0,
        },
        'postgres-load': {
          peakCpuPercent: 10,
          peakMemoryUsageBytes: 4_000,
          peakNetworkInputBytes: 5_000,
          peakNetworkOutputBytes: 6_000,
          maxRestartCount: 0,
          stoppedSamples: 0,
          missingSamples: 0,
          lastExitCode: 0,
          oomKilled: false,
        },
        'redis-load': {
          peakCpuPercent: redisCpu,
          peakMemoryUsageBytes: 7_000,
          peakNetworkInputBytes: 8_000,
          peakNetworkOutputBytes: 9_000,
          maxRestartCount: 0,
          stoppedSamples: 0,
          missingSamples: 0,
          lastExitCode: 0,
          oomKilled: false,
        },
      },
      peakPostgresConnections: 12,
      peakRedisConnectedClients: 13,
      peakRedisUsedMemoryBytes: 14_000,
      dependencyErrors: 2,
    },
  };
}

function normalizedMetricsWithEndpointLatency(endpoint, p95Ms, p99Ms) {
  const metrics = completeMetrics();
  metrics.load_request_failed = rate(0, 200);
  metrics[`load_${endpoint}_duration_ms`] = trend(10, p95Ms, p99Ms);
  return normalizeK6Summary(summary(metrics), {}, { measurementSeconds: 180 });
}

test('deriveBottleneckCandidate selects the earliest failure and correlates its own evidence window', () => {
  const candidate = deriveBottleneckCandidate({
    capacity: {
      probes: [
        {
          phase: 'coarse',
          vus: 10,
          metrics: normalizedMetricsWithEndpointLatency('login', 100, 200),
          evaluation: { passed: true },
          evidence: evidenceWindow({ authCpu: 99 }),
        },
        {
          phase: 'coarse',
          vus: 25,
          metrics: normalizedMetricsWithEndpointLatency(
            'userinfo',
            1_200,
            2_500,
          ),
          evaluation: { passed: false },
          evidence: evidenceWindow({ authStoppedSamples: 1, redisCpu: 99 }),
        },
        {
          phase: 'refine',
          vus: 17,
          metrics: normalizedMetricsWithEndpointLatency('login', 1_900, 3_000),
          evaluation: { passed: false },
          evidence: evidenceWindow({
            startedAt: '2026-09-02T01:03:04.004Z',
            endedAt: '2026-09-02T01:03:09.004Z',
            authCpu: 100,
          }),
        },
      ],
    },
    soak: { ran: false, windows: [] },
  });

  assert.deepEqual(candidate, {
    status: 'candidate',
    disclaimer: 'correlation only; not causation',
    phaseLabel: 'coarse probe at 25 VUs',
    startedAt: '2026-09-02T01:02:04.004Z',
    endedAt: '2026-09-02T01:02:09.004Z',
    endpoint: { name: 'userinfo', p95Ms: 1_200, p99Ms: 2_500 },
    service: {
      name: 'auth-service',
      worstStatus: 'stopped',
      peakCpuPercent: 70,
      peakMemoryUsageBytes: 1_000,
      peakNetworkInputBytes: 2_000,
      peakNetworkOutputBytes: 3_000,
      maxRestartCount: 1,
      stoppedSamples: 1,
      missingSamples: 0,
      lastExitCode: 137,
      oomKilled: true,
    },
    dependencies: {
      peakPostgresConnections: 12,
      peakRedisConnectedClients: 13,
      peakRedisUsedMemoryBytes: 14_000,
      dependencyErrors: 2,
    },
  });
});

test('deriveBottleneckCandidate selects the first failing soak window when every probe passed', () => {
  const candidate = deriveBottleneckCandidate({
    capacity: {
      probes: [
        {
          phase: 'coarse',
          vus: 10,
          metrics: normalizedMetricsWithEndpointLatency('login', 100, 200),
          evaluation: { passed: true },
          evidence: evidenceWindow(),
        },
      ],
    },
    soak: {
      ran: true,
      vus: 10,
      windows: [
        {
          minute: 0,
          metrics: normalizedMetricsWithEndpointLatency('login', 100, 200),
          evaluation: { passed: true },
          evidence: evidenceWindow(),
        },
        {
          minute: 1,
          metrics: normalizedMetricsWithEndpointLatency(
            'refresh',
            1_300,
            2_600,
          ),
          evaluation: { passed: false },
          evidence: evidenceWindow({
            startedAt: '2026-09-02T01:03:04.004Z',
            endedAt: '2026-09-02T01:03:05.004Z',
          }),
        },
      ],
    },
  });

  assert.equal(candidate.status, 'candidate');
  assert.equal(candidate.phaseLabel, 'soak minute 1 at 10 VUs');
  assert.deepEqual(candidate.endpoint, {
    name: 'refresh',
    p95Ms: 1_300,
    p99Ms: 2_600,
  });
  assert.equal(candidate.startedAt, '2026-09-02T01:03:04.004Z');
  assert.equal(candidate.endedAt, '2026-09-02T01:03:05.004Z');
});

test('deriveBottleneckCandidate reports insufficient evidence without an observed endpoint or window', () => {
  const metrics = normalizedMetricsWithEndpointLatency('login', 100, 200);
  metrics.endpointDurations = Object.fromEntries(
    Object.keys(metrics.endpointDurations).map((endpoint) => [
      endpoint,
      { count: 0, p95Ms: 0, p99Ms: 0 },
    ]),
  );
  assert.deepEqual(
    deriveBottleneckCandidate({
      capacity: {
        probes: [
          {
            phase: 'coarse',
            vus: 1,
            metrics,
            evaluation: { passed: false },
            evidence: null,
          },
        ],
      },
      soak: { ran: false, windows: [] },
    }),
    {
      status: 'insufficient evidence',
      disclaimer: 'correlation only; not causation',
      phaseLabel: 'coarse probe at 1 VUs',
    },
  );
});

test('deriveBottleneckCandidate rejects unsafe phase and timestamp evidence without reflecting it', () => {
  assert.throws(
    () =>
      deriveBottleneckCandidate({
        capacity: {
          probes: [
            {
              phase: `coarse\n${fixtureSecret}`,
              vus: 10,
              metrics: normalizedMetricsWithEndpointLatency(
                'userinfo',
                1_200,
                2_500,
              ),
              evaluation: { passed: false },
              evidence: evidenceWindow({
                startedAt: `2026-09-02T01:02:04.004Z\n${fixtureSecret}`,
              }),
            },
          ],
        },
      }),
    (error) => {
      assert.equal(error.message, 'Invalid bottleneck evidence');
      assert.doesNotMatch(error.message, new RegExp(fixtureSecret));
      return true;
    },
  );
});

test('sanitizeEnvironment constructs a strict fresh allowlisted object', () => {
  const source = {
    ...completeEnvironment(),
    targetUrl: `http://user:${fixtureSecret}@auth-service:3000/health?access_token=${fixtureSecret}`,
    platform: `linux\n| ${fixtureSecret}`,
    untrustedServiceImage: fixtureSecret,
    ADMIN_PASSWORD: fixtureSecret,
    SERVICE_CLIENT_SECRET: fixtureSecret,
    access_token: fixtureSecret,
    arbitraryUnknown: fixtureSecret,
    nested: { authorization: `Bearer ${fixtureSecret}` },
  };
  const safe = sanitizeEnvironment(source);

  assert.deepEqual(safe, {
    ...completeEnvironment(),
  });
  assert.notEqual(safe, source);
  assert.doesNotMatch(JSON.stringify(safe), new RegExp(fixtureSecret));
});

test('environment and Docker metadata parsers fail closed on malformed values', () => {
  assert.equal(parseDockerServerVersion('"28.3.3"\n'), '28.3.3');
  assert.equal(parseDockerComposeVersion('2.39.2\n'), '2.39.2');
  const serviceRecord = `${JSON.stringify('a'.repeat(64))}\t${JSON.stringify(`sha256:${'d'.repeat(64)}`)}\t"auth-load"\t"auth-service"`;
  assert.deepEqual(parseServiceImageRecord(serviceRecord), {
    containerId: 'a'.repeat(64),
    serviceImage: `sha256:${'d'.repeat(64)}`,
  });

  for (const malformed of [
    completeEnvironment({ target: 'http://localhost:3000' }),
    completeEnvironment({
      host: {
        ...completeEnvironment().host,
        cpuModel: `CPU\n${fixtureSecret}`,
      },
    }),
    completeEnvironment({
      docker: { version: fixtureSecret, composeVersion: '2.39.2' },
    }),
    completeEnvironment({ serviceImage: fixtureSecret }),
  ]) {
    assert.throws(
      () => sanitizeEnvironment(malformed),
      (error) => {
        assert.doesNotMatch(error.message, new RegExp(fixtureSecret));
        return true;
      },
    );
  }
  assert.throws(
    () => parseDockerServerVersion(fixtureSecret),
    (error) => {
      assert.doesNotMatch(error.message, new RegExp(fixtureSecret));
      return true;
    },
  );
  assert.throws(() => parseDockerComposeVersion(`2.39.2\n${fixtureSecret}`));
  assert.throws(
    () => parseServiceImageRecord(fixtureSecret),
    (error) => {
      assert.doesNotMatch(error.message, new RegExp(fixtureSecret));
      return true;
    },
  );
});

test('renderSummaryMarkdown includes verdict, duration, SLOs, endpoints, and no secret', () => {
  const passingMetrics = completeMetrics();
  passingMetrics.load_request_failed = rate(1, 199);
  const markdown = renderSummaryMarkdown({
    passed: true,
    environment: completeEnvironment({ measureSeconds: 8, soakSeconds: 61 }),
    slo: {
      maxRequestFailureRateExclusive: `0.01 |\n${fixtureSecret}`,
      maxCheckFailureRate: 0,
      maxP95MsExclusive: 1000,
      maxP99MsExclusive: 2000,
    },
    metrics: normalizeK6Summary(
      summary(passingMetrics),
      {},
      {
        measurementSeconds: 8,
      },
    ),
    violations: [fixtureSecret],
    firstViolationMinute: null,
    trafficMix: {
      introspection: 45,
      userinfo: 25,
      refresh: 12,
      discovery: 8,
      jwks: 5,
      relogin: 5,
    },
    securityGate: {
      path: '/admin/session',
      timeToFirst429Ms: 123,
      authRejectedCount: 10,
      rateLimitedCount: 5,
      unexpectedCount: 0,
    },
    monitorSummary: {
      sampleCount: 6,
      services: Object.fromEntries(
        ['auth-service', 'postgres-load', 'redis-load'].map(
          (service, index) => [
            service,
            {
              peakCpuPercent: 70 + index,
              peakMemoryUsageBytes: 1_000 + index,
              peakNetworkInputBytes: 2_000 + index,
              peakNetworkOutputBytes: 3_000 + index,
              maxRestartCount: service === 'auth-service' ? 1 : 0,
              stoppedSamples: service === 'postgres-load' ? 1 : 0,
              missingSamples: 0,
              lastExitCode: service === 'postgres-load' ? 15 : 0,
              oomKilled: false,
            },
          ],
        ),
      ),
      peakPostgresConnections: 20,
      peakRedisConnectedClients: 30,
      peakRedisUsedMemoryBytes: 40_000,
      dependencyErrors: 2,
    },
  });

  assert.match(markdown, /\[PASS\]/);
  assert.match(markdown, /Soak duration: 61 seconds/);
  assert.match(markdown, /\| SLO \| Limit \|/);
  assert.match(markdown, /\| Endpoint \| Count \| p95 \(ms\) \| p99 \(ms\) \|/);
  assert.match(markdown, /\| login \| 30 \| 101 \| 201 \|/);
  assert.match(markdown, /Request failure rate \| < not recorded/);
  assert.match(markdown, /Request failure rate \| 0\.005/);
  assert.match(markdown, /Request count \| 200/);
  assert.match(markdown, /RPS \| 25/);
  assert.match(markdown, /Traffic mix/);
  assert.match(markdown, /introspection \| 45%/);
  assert.match(markdown, /Security gate/);
  assert.match(markdown, /\/admin\/session \| 123/);
  assert.match(markdown, /Monitor bottleneck evidence/);
  assert.match(markdown, /auth-service \| 70 \| 1000 \| 2000 \| 3000 \| 1/);
  assert.match(markdown, /Last exit code \| OOM killed/);
  assert.match(markdown, /postgres-load.*15.*no/);
  assert.match(markdown, /PostgreSQL connections \| 20/);
  assert.match(markdown, /## Violations\n\n- none/);
  assert.doesNotMatch(markdown, new RegExp(fixtureSecret));
});

test('renderSummaryMarkdown derives safe failure names instead of rendering raw failure data', () => {
  const candidateMetrics = normalizedMetricsWithEndpointLatency(
    'userinfo',
    1_200,
    2_500,
  );
  const markdown = renderSummaryMarkdown({
    passed: false,
    environment: completeEnvironment({
      arbitraryUnknown: `http://auth-service:3000/health?body=${fixtureSecret}`,
    }),
    metrics: normalizeK6Summary(
      summary(completeMetrics()),
      {},
      {
        measurementSeconds: 180,
      },
    ),
    trafficMix: {
      introspection: 45,
      userinfo: 25,
      refresh: 12,
      discovery: 8,
      jwks: 5,
      relogin: 5,
    },
    securityGate: {
      path: '/admin/session',
      timeToFirst429Ms: 123,
      authRejectedCount: 10,
      rateLimitedCount: 5,
      unexpectedCount: 0,
    },
    monitorSummary: {
      sampleCount: 1,
      services: Object.fromEntries(
        ['auth-service', 'postgres-load', 'redis-load'].map((service) => [
          service,
          {
            peakCpuPercent: 0,
            peakMemoryUsageBytes: 0,
            peakNetworkInputBytes: 0,
            peakNetworkOutputBytes: 0,
            maxRestartCount: 0,
            stoppedSamples: 0,
            missingSamples: 0,
            lastExitCode: 0,
            oomKilled: false,
          },
        ]),
      ),
      peakPostgresConnections: 0,
      peakRedisConnectedClients: 0,
      peakRedisUsedMemoryBytes: 0,
      dependencyErrors: 0,
    },
    capacity: {
      probes: [
        {
          phase: 'coarse',
          vus: 25,
          metrics: candidateMetrics,
          evaluation: { passed: false },
          evidence: evidenceWindow({ authStoppedSamples: 1 }),
        },
      ],
    },
    soak: { ran: false, windows: [] },
    violations: [fixtureSecret],
    error: { body: fixtureSecret },
  });

  assert.match(markdown, /- request failure rate must be < 0\.01/);
  assert.match(markdown, /Correlated bottleneck candidate \(not causation\)/);
  assert.match(markdown, /coarse probe at 25 VUs/);
  assert.match(markdown, /userinfo \| 1200 \| 2500/);
  assert.match(
    markdown,
    /auth-service \| stopped \| 70 \| 1000 \| 2000 \| 3000 \| 1/,
  );
  assert.doesNotMatch(markdown, new RegExp(fixtureSecret));
});

test('renderSummaryMarkdown rejects unsafe monitor exit metadata without echoing it', () => {
  const report = {
    passed: false,
    environment: completeEnvironment(),
    metrics: normalizeK6Summary(
      summary(completeMetrics()),
      {},
      {
        measurementSeconds: 180,
      },
    ),
    trafficMix: {
      introspection: 45,
      userinfo: 25,
      refresh: 12,
      discovery: 8,
      jwks: 5,
      relogin: 5,
    },
    securityGate: {
      path: '/admin/session',
      timeToFirst429Ms: 123,
      authRejectedCount: 10,
      rateLimitedCount: 5,
      unexpectedCount: 0,
    },
    monitorSummary: evidenceWindow().monitorSummary,
    capacity: { probes: [] },
    soak: { ran: false, windows: [] },
  };
  report.monitorSummary.services['auth-service'].lastExitCode = fixtureSecret;
  assert.throws(
    () => renderSummaryMarkdown(report),
    (error) => {
      assert.doesNotMatch(error.message, new RegExp(fixtureSecret));
      return true;
    },
  );
});
