import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { EventEmitter } from 'node:events';
import process from 'node:process';
import test from 'node:test';
import { parseOptions } from '../lib/config.mjs';
import {
  bucketMonitorSamples,
  runCapacityWorkflow,
  safeErrorMessage,
} from '../lib/orchestrator.mjs';
import {
  createChildEnvironment,
  createCommandRunner,
  nodeDependencies,
} from '../run-capacity.mjs';

const SECRET_FRAGMENT = '07070707';
const MEASUREMENT_EPOCH_MS = Date.parse('2026-09-02T01:02:04.004Z');
const SERVICE_CONTAINER_ID = 'a'.repeat(64);
const SERVICE_IMAGE_ID = `sha256:${'d'.repeat(64)}`;

function trend(count = 1, p95 = 100, p99 = 200) {
  return {
    type: 'trend',
    contains: 'default',
    values: { count, 'p(95)': p95, 'p(99)': p99 },
  };
}

function rate(trueCount, falseCount) {
  return {
    type: 'rate',
    contains: 'default',
    values: {
      passes: trueCount,
      fails: falseCount,
      rate: trueCount / (trueCount + falseCount),
    },
  };
}

function counter(count, rateValue = count) {
  return {
    type: 'counter',
    contains: 'default',
    values: { count, rate: rateValue },
  };
}

function singleTrend(value) {
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

function service(status = 'running', restartCount = 0) {
  return {
    status,
    cpuPercent: 1,
    memoryUsageBytes: 1_000,
    memoryLimitBytes: 2_000,
    networkInputBytes: 3_000,
    networkOutputBytes: 4_000,
    restartCount,
  };
}

function monitorSample({
  timestamp = '2026-09-02T01:02:04.004Z',
  statuses = {},
  authRestartCount = 0,
  dependencyErrors = 0,
} = {}) {
  return {
    timestamp,
    services: Object.fromEntries(
      ['auth-service', 'postgres-load', 'redis-load'].map((name) => [
        name,
        service(
          statuses[name] ?? 'running',
          name === 'auth-service' ? authRestartCount : 0,
        ),
      ]),
    ),
    postgresConnections: 5,
    redis: {
      connectedClients: 6,
      usedMemoryBytes: 7_000,
      rejectedConnections: 0,
    },
    dependencyErrors,
  };
}

function capacitySummary({
  passed = true,
  soakSeconds,
  failingMinute,
  measurementEpochMs = MEASUREMENT_EPOCH_MS,
} = {}) {
  const endpointNames = [
    'login',
    'introspection',
    'userinfo',
    'refresh',
    'discovery',
    'jwks',
    'revoke',
  ];
  if (soakSeconds !== undefined) {
    const metrics = {
      load_measurement_epoch_ms: singleTrend(measurementEpochMs),
    };
    for (let minute = 0; minute < Math.ceil(soakSeconds / 60); minute += 1) {
      metrics[`load_request_failed{minute:${minute}}`] = {
        ...rate(passed ? 0 : 2, passed ? 100 : 98),
      };
      metrics[`load_check_failed{minute:${minute}}`] = rate(0, 100);
      const p95 = minute === failingMinute ? 1_500 : 100;
      metrics[`load_http_req_duration_ms{minute:${minute}}`] = trend(
        1,
        p95,
        p95,
      );
      metrics[`load_requests{minute:${minute}}`] = counter(100, 10);
      for (const endpoint of endpointNames)
        metrics[`load_${endpoint}_duration_ms{minute:${minute}}`] = trend(
          1,
          p95,
          p95,
        );
    }
    return { metrics };
  }
  return {
    metrics: {
      load_request_failed: rate(passed ? 0 : 2, passed ? 100 : 98),
      load_check_failed: rate(0, 100),
      load_http_req_duration_ms: trend(),
      load_requests: counter(100, 10),
      ...Object.fromEntries(
        endpointNames.map((endpoint) => [
          `load_${endpoint}_duration_ms`,
          trend(),
        ]),
      ),
    },
  };
}

const SECURITY_SUMMARY = Object.freeze({
  metrics: {
    security_auth_rejected_total: counter(10),
    security_rate_limited_total: {
      ...counter(5),
      thresholds: { 'count>0': { ok: true } },
    },
    security_unexpected_total: {
      ...counter(0, 0),
      thresholds: { 'count==0': { ok: true } },
    },
    security_time_to_first_429_ms: singleTrend(123),
  },
});

const SMOKE_SUMMARY = Object.freeze({
  metrics: {
    checks: {
      ...rate(7, 0),
      thresholds: { 'rate==1': { ok: true } },
    },
    load_harness_failure: {
      ...rate(0, 1),
      thresholds: { 'rate==0': { ok: true } },
    },
  },
});

function envValue(args, name) {
  const prefix = `${name}=`;
  return args.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createHarness({
  probePasses = () => true,
  probeSummary,
  probeExitCode = () => 0,
  securitySummary = SECURITY_SUMMARY,
  smokeSummary = SMOKE_SUMMARY,
  soakSummary,
  missingSummaryScript,
  abortOnFirstProbe,
  soakMonitorSamples = [],
  k6StartedAtMs = Date.parse('2026-09-02T01:02:03.004Z'),
  checkpointSamples = [],
  checkpointBarrier,
  monitorReady = Promise.resolve(),
  cleanupExitCodes = [0, 0],
  failFinalRuntimeCleanup = false,
  monitorStopError = false,
  startupError = false,
  signal,
} = {}) {
  const commands = [];
  const events = [];
  const files = new Map();
  let resultDirectory;
  let monitorStarts = 0;
  let monitorStops = 0;
  let monitorCheckpoints = 0;
  let probeCount = 0;
  let cleanupCount = 0;
  let runtimeCleanupCount = 0;
  const monitorSamples = [
    monitorSample({ timestamp: '2026-09-02T01:02:03.000Z' }),
  ];

  const deps = {
    signal,
    async runCommand(file, args, options = {}) {
      commands.push({ file, args: [...args], options });
      events.push({ kind: 'command', file, args: [...args], options });
      const script = args.at(-1);
      if (args.includes('down')) {
        const exitCode = cleanupExitCodes[cleanupCount] ?? 0;
        cleanupCount += 1;
        return { exitCode, stdout: '', stderr: 'untrusted cleanup output' };
      }
      if (startupError && args.includes('up'))
        return { exitCode: 17, stdout: '', stderr: 'untrusted startup output' };
      if (args[0] === 'version') {
        return { exitCode: 0, stdout: '"28.3.3"\n', stderr: '' };
      }
      if (args.includes('version') && args.at(-1) === '--short') {
        return { exitCode: 0, stdout: '2.39.2\n', stderr: '' };
      }
      if (args.includes('ps') && args.includes('auth-service')) {
        return { exitCode: 0, stdout: `${SERVICE_CONTAINER_ID}\n`, stderr: '' };
      }
      if (args[0] === 'inspect') {
        return {
          exitCode: 0,
          stdout: `${JSON.stringify(SERVICE_CONTAINER_ID)}\t${JSON.stringify(SERVICE_IMAGE_ID)}\t"auth-load"\t"auth-service"\n`,
          stderr: '',
        };
      }
      if (script === '/scripts/provision.js')
        return { exitCode: 0, stdout: '', stderr: '' };
      if (script?.startsWith('/scripts/')) {
        const containerSummaryPath = envValue(args, 'SUMMARY_PATH');
        if (missingSummaryScript === script)
          return { exitCode: 1, stdout: '', stderr: 'sensitive stderr' };
        const summaryName = containerSummaryPath.split('/').at(-1);
        let raw;
        if (script === '/scripts/rate-limit.js') raw = securitySummary;
        else if (script === '/scripts/smoke.js') raw = smokeSummary;
        else {
          probeCount += 1;
          if (abortOnFirstProbe && probeCount === 1) abortOnFirstProbe();
          const runKind = envValue(args, 'RUN_KIND');
          const vus = Number(envValue(args, 'VUS'));
          if (runKind === 'soak') monitorSamples.push(...soakMonitorSamples);
          raw =
            runKind === 'soak'
              ? (soakSummary ??
                capacitySummary({
                  passed: true,
                  soakSeconds: Number(envValue(args, 'SOAK_SECONDS')),
                }))
              : (probeSummary?.(vus) ??
                capacitySummary({ passed: probePasses(vus) }));
        }
        files.set(`${resultDirectory}/${summaryName}`, JSON.stringify(raw));
        return {
          exitCode:
            script === '/scripts/journey.js'
              ? probeExitCode({
                  runKind: envValue(args, 'RUN_KIND'),
                  vus: Number(envValue(args, 'VUS')),
                })
              : 0,
          stdout: '',
          stderr: '',
          startedAtMs: k6StartedAtMs,
        };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    },
    systemInfo() {
      return {
        os: 'darwin',
        arch: 'arm64',
        cpuModel: 'Apple M3 Pro',
        cpuCount: 12,
        memoryBytes: 36_000_000_000,
      };
    },
    async fetchHealth() {
      return true;
    },
    startMonitor(_monitorDeps, path) {
      monitorStarts += 1;
      events.push({ kind: 'monitor-start', path });
      return {
        ready: () => monitorReady,
        snapshot: () => monitorSamples.slice(),
        async checkpoint() {
          monitorCheckpoints += 1;
          events.push({ kind: 'monitor-checkpoint' });
          if (checkpointBarrier) await checkpointBarrier.promise;
          monitorSamples.push(
            checkpointSamples[monitorCheckpoints - 1] ?? monitorSample(),
          );
        },
        async stop() {
          monitorStops += 1;
          events.push({ kind: 'monitor-stop' });
          if (monitorStopError) throw new Error('untrusted monitor stop error');
        },
      };
    },
    now: () => new Date('2026-09-02T01:02:03.004Z'),
    randomBytes: (length) => Buffer.alloc(length, 7),
    async writeFile(path, value, options) {
      files.set(path, String(value));
      events.push({ kind: 'write', path, value: String(value), options });
      if (path.endsWith('/environment.json'))
        resultDirectory = path.slice(0, -'/environment.json'.length);
    },
    async readFile(path) {
      if (!files.has(path)) {
        const error = new Error('fixture file is absent');
        error.code = 'ENOENT';
        throw error;
      }
      return files.get(path);
    },
    async mkdir(path) {
      events.push({ kind: 'mkdir', path });
      if (path.startsWith('load-tests/results/')) resultDirectory = path;
    },
    async chmod(path, mode) {
      events.push({ kind: 'chmod', path, mode });
    },
    async rm(path) {
      if (path === 'load-tests/.runtime.env') {
        runtimeCleanupCount += 1;
        if (failFinalRuntimeCleanup && runtimeCleanupCount >= 2)
          throw new Error('untrusted runtime cleanup error');
      }
      files.delete(path);
      events.push({ kind: 'rm', path });
    },
    async sleep() {},
  };

  return {
    deps,
    commands,
    events,
    files,
    monitorCounts: () => ({ starts: monitorStarts, stops: monitorStops }),
    checkpointCount: () => monitorCheckpoints,
  };
}

function options(overrides = {}) {
  return {
    ...parseOptions({
      MAX_VUS: '40',
      WARMUP_SECONDS: '1',
      MEASURE_SECONDS: '1',
      SOAK_SECONDS: '61',
    }),
    ...overrides,
  };
}

function k6Calls(commands, script) {
  return commands.filter(({ args }) => args.at(-1) === script);
}

const CLEANUP_ARGS = [
  'compose',
  '--project-name',
  'auth-load',
  '-f',
  'docker-compose.load.yml',
  'down',
  '--volumes',
  '--remove-orphans',
];

test('workflow securely prepares runtime state and switches guard profiles in order', async () => {
  const harness = createHarness({ probePasses: (vus) => vus < 25 });
  const report = await runCapacityWorkflow(
    options({ projectName: 'not-auth-load' }),
    harness.deps,
  );

  const cleanups = harness.commands.filter(({ args }) => args.includes('down'));
  assert.equal(cleanups.length, 2);
  assert.deepEqual(
    cleanups.map(({ args }) => args),
    [CLEANUP_ARGS, CLEANUP_ARGS],
  );
  const runtimeWrite = harness.events.find(
    ({ kind, path }) => kind === 'write' && path === 'load-tests/.runtime.env',
  );
  const staleRuntimeRemoval = harness.events.findIndex(
    ({ kind, path }) => kind === 'rm' && path === 'load-tests/.runtime.env',
  );
  assert.equal(runtimeWrite.options.mode, 0o600);
  const firstStart = harness.events.findIndex(
    ({ kind, args }) => kind === 'command' && args.includes('up'),
  );
  assert.ok(
    staleRuntimeRemoval >= 0 &&
      staleRuntimeRemoval < harness.events.indexOf(runtimeWrite),
  );
  assert.ok(harness.events.indexOf(runtimeWrite) < firstStart);

  const provision = k6Calls(harness.commands, '/scripts/provision.js')[0];
  assert.equal(envValue(provision.args, 'MAX_VUS'), '40');
  assert.deepEqual(provision.options.env, {
    LOAD_HTTP_THROTTLE_LIMIT: '1000000',
    LOAD_LOGIN_RATE_LIMIT_IP_MAX: '100000',
  });
  const security = k6Calls(harness.commands, '/scripts/rate-limit.js')[0];
  assert.equal(
    envValue(security.args, 'SUMMARY_PATH'),
    '/results/2026-09-02T01-02-03-004Z/security.json',
  );
  const recreates = harness.commands.filter(({ args }) =>
    args.includes('--force-recreate'),
  );
  assert.deepEqual(
    recreates.map(({ options: commandOptions }) => commandOptions.env),
    [
      { LOAD_HTTP_THROTTLE_LIMIT: '120', LOAD_LOGIN_RATE_LIMIT_IP_MAX: '10' },
      {
        LOAD_HTTP_THROTTLE_LIMIT: '1000000',
        LOAD_LOGIN_RATE_LIMIT_IP_MAX: '100000',
      },
    ],
  );
  assert.equal(report.summaryPath.endsWith('/summary.md'), true);
  assert.deepEqual(harness.monitorCounts(), { starts: 1, stops: 1 });
  assert.deepEqual(report.environment, {
    maxVus: 40,
    warmupSeconds: 1,
    measureSeconds: 1,
    soakSeconds: 61,
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
    serviceImage: SERVICE_IMAGE_ID,
  });
  const markdown = harness.files.get(report.summaryPath);
  assert.match(markdown, /## Environment/);
  assert.match(markdown, /## Traffic mix/);
  assert.match(markdown, /## Security gate/);
  assert.match(markdown, /Time to first 429/);
  assert.match(markdown, /## Monitor bottleneck evidence/);
  assert.match(markdown, /\| Phase \| VUs \| RPS \| Overall p95/);
  assert.match(markdown, /Endpoint counts/);
  for (const [path, value] of harness.files) {
    assert.notEqual(path, 'load-tests/.runtime.env');
    assert.doesNotMatch(value, new RegExp(SECRET_FRAGMENT));
  }
  assert.doesNotMatch(
    JSON.stringify(harness.commands),
    new RegExp(SECRET_FRAGMENT),
  );
});

test('workflow stops coarse search at failure, refines the bracket, and soaks last passing VUs', async () => {
  const harness = createHarness({ probePasses: (vus) => vus <= 17 });
  const report = await runCapacityWorkflow(options(), harness.deps);
  const journeys = k6Calls(harness.commands, '/scripts/journey.js');

  assert.deepEqual(
    journeys.map(({ args }) => [
      Number(envValue(args, 'VUS')),
      envValue(args, 'RUN_KIND'),
    ]),
    [
      [10, 'probe'],
      [25, 'probe'],
      [17, 'probe'],
      [21, 'probe'],
      [17, 'soak'],
    ],
  );
  assert.deepEqual(
    {
      lastPassingVus: report.capacity.lastPassingVus,
      firstFailingVus: report.capacity.firstFailingVus,
      atLeast: report.capacity.atLeast,
    },
    { lastPassingVus: 17, firstFailingVus: 21, atLeast: false },
  );
  assert.equal(report.soak.vus, 17);
  assert.equal(report.soak.windows.length, 2);
  assert.equal(harness.checkpointCount(), journeys.length);
});

test('capacity probes wait for the initial monitor baseline sample', async () => {
  const readiness = deferred();
  const harness = createHarness({ monitorReady: readiness.promise });
  const workflow = runCapacityWorkflow(options({ maxVus: 10 }), harness.deps);

  await new Promise((resolve) => globalThis.setImmediate(resolve));
  assert.deepEqual(harness.monitorCounts(), { starts: 1, stops: 0 });
  assert.equal(k6Calls(harness.commands, '/scripts/journey.js').length, 0);

  readiness.resolve();
  await workflow;
  assert.ok(k6Calls(harness.commands, '/scripts/journey.js').length > 0);
});

test('probe evaluation awaits the terminal checkpoint and includes its violation', async () => {
  const checkpointBarrier = deferred();
  const harness = createHarness({
    checkpointBarrier,
    checkpointSamples: [
      monitorSample({ statuses: { 'auth-service': 'stopped' } }),
    ],
  });
  const workflow = runCapacityWorkflow(options({ maxVus: 5 }), harness.deps);

  await new Promise((resolve) => globalThis.setImmediate(resolve));
  assert.equal(harness.checkpointCount(), 1);
  assert.equal(
    harness.commands.filter(({ args }) => args.includes('down')).length,
    1,
  );

  checkpointBarrier.resolve();
  const report = await workflow;
  assert.equal(report.capacity.probes[0].evaluation.passed, false);
  assert.match(
    report.capacity.probes[0].evaluation.violations.join('\n'),
    /auth-service stopped/,
  );
});

test('monitor readiness rejection aborts before probes and still cleans up', async () => {
  const readiness = deferred();
  const harness = createHarness({ monitorReady: readiness.promise });
  const workflow = runCapacityWorkflow(options({ maxVus: 10 }), harness.deps);

  await new Promise((resolve) => globalThis.setImmediate(resolve));
  readiness.reject(new Error('untrusted initial monitor failure'));
  await assert.rejects(workflow, /monitor readiness failed/);

  assert.equal(k6Calls(harness.commands, '/scripts/journey.js').length, 0);
  assert.deepEqual(harness.monitorCounts(), { starts: 1, stops: 1 });
  assert.equal(harness.files.has('load-tests/.runtime.env'), false);
  assert.deepEqual(harness.commands.at(-1).args, CLEANUP_ARGS);
});

test('a monitor readiness method must return a promise before probes start', async () => {
  const harness = createHarness({ monitorReady: null });
  await assert.rejects(
    runCapacityWorkflow(options({ maxVus: 10 }), harness.deps),
    /monitor readiness failed/,
  );
  assert.equal(k6Calls(harness.commands, '/scripts/journey.js').length, 0);
  assert.deepEqual(harness.commands.at(-1).args, CLEANUP_ARGS);
});

test('all coarse levels passing reports an observed lower bound', async () => {
  const harness = createHarness({
    k6StartedAtMs: Date.parse('2026-09-02T01:02:07.500Z'),
  });
  const report = await runCapacityWorkflow(
    options({ maxVus: 25 }),
    harness.deps,
  );
  assert.equal(report.capacity.lastPassingVus, 25);
  assert.equal(report.capacity.firstFailingVus, null);
  assert.equal(report.capacity.atLeast, true);
  assert.equal(report.soak.measurementStartedAt, '2026-09-02T01:02:04.004Z');
  assert.equal(report.soak.measurementEndedAt, '2026-09-02T01:03:05.004Z');
  const markdown = harness.files.get(report.summaryPath);
  assert.match(markdown, /Highest probe-passing level: at least 25 VUs/);
  assert.match(markdown, /Soak endurance: PASS at 25 VUs for 61 seconds/);
});

test('soak monitoring uses the summary epoch and not the host process timestamp', async () => {
  const measurementEpochMs = Date.parse('2026-09-02T05:06:07.008Z');
  const harness = createHarness({
    k6StartedAtMs: 1,
    soakSummary: capacitySummary({ soakSeconds: 61, measurementEpochMs }),
    soakMonitorSamples: [
      monitorSample({
        timestamp: '2026-09-02T05:07:07.008Z',
        statuses: { 'redis-load': 'stopped' },
      }),
    ],
  });
  const report = await runCapacityWorkflow(
    options({ maxVus: 10 }),
    harness.deps,
  );

  assert.equal(report.soak.measurementStartedAt, '2026-09-02T05:06:07.008Z');
  assert.equal(report.soak.measurementEndedAt, '2026-09-02T05:07:08.008Z');
  assert.equal(report.soak.firstViolationMinute, 1);
  assert.match(
    report.soak.windows[1].evaluation.violations.join('\n'),
    /redis-load stopped/,
  );
});

test('a valid failed SLO is capacity data and not a harness exception', async () => {
  const harness = createHarness({ probePasses: () => false });
  const report = await runCapacityWorkflow(
    options({ maxVus: 10 }),
    harness.deps,
  );
  assert.equal(report.capacity.lastPassingVus, 0);
  assert.equal(report.capacity.firstFailingVus, 5);
  assert.equal(
    report.capacity.probes.every(({ evaluation }) => !evaluation.passed),
    true,
  );
  assert.equal(report.soak.ran, false);
  const markdown = harness.files.get(report.summaryPath);
  assert.match(markdown, /Soak endurance: NOT RUN/);
  assert.doesNotMatch(markdown, /FAIL at 0 VUs/);
});

test('nonzero k6 exits preserve stopped and missing target state as SLO data', async (t) => {
  for (const [target, status] of [
    ['auth-service', 'stopped'],
    ['postgres-load', 'stopped'],
    ['redis-load', 'stopped'],
    ['auth-service', 'missing'],
  ]) {
    await t.test(`${target} ${status}`, async () => {
      const harness = createHarness({
        probeExitCode: () => 99,
        checkpointSamples: [monitorSample({ statuses: { [target]: status } })],
      });
      const report = await runCapacityWorkflow(
        options({ maxVus: 5 }),
        harness.deps,
      );
      assert.equal(report.capacity.firstFailingVus, 5);
      assert.match(
        report.capacity.probes[0].evaluation.violations.join('\n'),
        new RegExp(`${target} ${status}`),
      );
      assert.match(harness.files.get(report.summaryPath), /Result: \[FAIL\]/);
      assert.ok(
        harness.files.has(
          report.summaryPath.replace('summary.md', 'capacity.json'),
        ),
      );
    });
  }
});

test('soak reports the first minute with an exact auth-service restart sample', async () => {
  const harness = createHarness({
    soakMonitorSamples: [
      monitorSample({
        timestamp: '2026-09-02T01:03:04.004Z',
        authRestartCount: 1,
        dependencyErrors: 0,
      }),
    ],
  });
  const report = await runCapacityWorkflow(
    options({ maxVus: 10 }),
    harness.deps,
  );
  assert.equal(report.soak.firstViolationMinute, 1);
  assert.equal(report.soak.windows[0].evaluation.passed, true);
  assert.match(
    report.soak.windows[1].evaluation.violations.join('\n'),
    /service restarted/,
  );
});

test('soak evaluation includes the forced terminal sample after the final edge', async () => {
  const harness = createHarness({
    checkpointSamples: [
      monitorSample(),
      monitorSample({
        timestamp: '2026-09-02T01:03:05.100Z',
        statuses: { 'auth-service': 'stopped' },
      }),
    ],
  });
  const report = await runCapacityWorkflow(
    options({ maxVus: 10 }),
    harness.deps,
  );
  assert.equal(report.soak.firstViolationMinute, 1);
  assert.match(
    report.soak.windows[1].evaluation.violations.join('\n'),
    /auth-service stopped/,
  );
});

test('monitor soak buckets exclude warmup and retain exact measurement edges', () => {
  const measurementStartMs = Date.parse('2026-09-02T01:02:04.004Z');
  const samples = [
    '2026-09-02T01:02:04.003Z',
    '2026-09-02T01:02:04.004Z',
    '2026-09-02T01:03:04.003Z',
    '2026-09-02T01:03:04.004Z',
    '2026-09-02T01:03:05.004Z',
    '2026-09-02T01:03:05.005Z',
  ].map((timestamp) => ({ timestamp }));
  const buckets = bucketMonitorSamples(samples, {
    measurementStartMs,
    measurementDurationMs: 61_000,
    bucketCount: 2,
  });
  assert.deepEqual(
    buckets.map((bucket) => bucket.map(({ timestamp }) => timestamp)),
    [
      ['2026-09-02T01:02:04.004Z', '2026-09-02T01:03:04.003Z'],
      ['2026-09-02T01:03:04.004Z', '2026-09-02T01:03:05.004Z'],
    ],
  );
});

test('soak fails closed without a single authoritative measurement epoch', async () => {
  const raw = capacitySummary({ soakSeconds: 61 });
  delete raw.metrics.load_measurement_epoch_ms;
  const harness = createHarness({ soakSummary: raw, k6StartedAtMs: null });
  await assert.rejects(
    runCapacityWorkflow(options({ maxVus: 10 }), harness.deps),
    /soak summary parsing failed/,
  );
  assert.deepEqual(harness.commands.at(-1).args, CLEANUP_ARGS);
});

test('failed soak reports probe capacity separately and renders earliest violating metrics', async () => {
  const harness = createHarness({
    soakSummary: capacitySummary({ soakSeconds: 61, failingMinute: 0 }),
    soakMonitorSamples: [
      monitorSample({
        timestamp: '2026-09-02T01:02:04.004Z',
        authRestartCount: 1,
        dependencyErrors: 7,
      }),
    ],
  });
  const report = await runCapacityWorkflow(
    options({ maxVus: 10 }),
    harness.deps,
  );
  const markdown = harness.files.get(report.summaryPath);
  assert.equal(report.capacity.lastPassingVus, 10);
  assert.equal(report.soak.passed, false);
  assert.equal(report.soak.firstViolationMinute, 0);
  assert.equal(report.metrics.p95Ms, 1_500);
  assert.match(markdown, /Highest probe-passing level: at least 10 VUs/);
  assert.match(markdown, /Soak endurance: FAIL at 10 VUs for 61 seconds/);
  assert.match(markdown, /First violation minute: 0/);
  assert.match(markdown, /\| Request failure rate \| 0 \|/);
  assert.match(markdown, /\| Check failure rate \| 0 \|/);
  assert.match(markdown, /\| Overall p95 \(ms\) \| 1500 \|/);
  assert.match(markdown, /\| Overall p99 \(ms\) \| 1500 \|/);
  assert.match(markdown, /\| Service restarted \| yes \|/);
  assert.match(markdown, /\| Dependency errors \| 7 \|/);
  assert.match(markdown, /- p95 latency must be < 1000 ms/);
  assert.match(markdown, /- endpoint login p95 latency must be < 1000 ms/);
  assert.match(markdown, /- service restarted/);
  assert.match(markdown, /- dependency connection errors: 7/);
  assert.doesNotMatch(markdown, /survived/i);
});

test('persistent dependency errors reach soak evaluation and sanitized reports', async () => {
  const harness = createHarness({
    soakMonitorSamples: [
      monitorSample({
        timestamp: '2026-09-02T01:02:04.004Z',
        dependencyErrors: 7,
      }),
    ],
  });
  const report = await runCapacityWorkflow(
    options({ maxVus: 10 }),
    harness.deps,
  );
  assert.equal(report.soak.firstViolationMinute, 0);
  assert.match(
    report.soak.windows[0].evaluation.violations.join('\n'),
    /dependency connection errors: 7/,
  );
  assert.match(
    harness.files.get(report.summaryPath.replace(/summary\.md$/, 'soak.json')),
    /"dependencyErrors": 7/,
  );
});

test('smoke mode runs its deterministic gate without monitoring or capacity claims', async () => {
  const harness = createHarness();
  const report = await runCapacityWorkflow(
    options({ mode: 'smoke', maxVus: 1 }),
    harness.deps,
  );
  assert.equal(k6Calls(harness.commands, '/scripts/smoke.js').length, 1);
  assert.equal(k6Calls(harness.commands, '/scripts/journey.js').length, 0);
  assert.deepEqual(harness.monitorCounts(), { starts: 0, stops: 0 });
  assert.equal(report.mode, 'smoke');
  assert.equal(report.capacity, undefined);
});

test('a nonzero k6 exit without a summary is a safe harness error and still cleans up', async () => {
  const harness = createHarness({ missingSummaryScript: '/scripts/smoke.js' });
  await assert.rejects(
    runCapacityWorkflow(options({ mode: 'smoke', maxVus: 1 }), harness.deps),
    (error) => {
      assert.match(error.message, /smoke gate failed/);
      assert.doesNotMatch(error.message, /sensitive stderr/);
      return true;
    },
  );
  assert.equal(
    harness.commands.filter(({ args }) => args.includes('down')).length,
    2,
  );
});

test('security profile must prove a 429 before capacity traffic starts', async () => {
  const harness = createHarness({
    securitySummary: {
      metrics: {
        security_rate_limited_total: {
          values: { count: 0 },
          thresholds: { 'count>0': { ok: false } },
        },
        security_unexpected_total: {
          values: { count: 0 },
          thresholds: { 'count==0': { ok: true } },
        },
      },
    },
  });
  await assert.rejects(
    runCapacityWorkflow(options(), harness.deps),
    /security gate failed/,
  );
  assert.equal(k6Calls(harness.commands, '/scripts/journey.js').length, 0);
  assert.deepEqual(harness.commands.at(-1).args, CLEANUP_ARGS);
});

test('security gate requires one bounded time-to-first-429 observation', async () => {
  for (const metric of [
    undefined,
    singleTrend(300_001),
    {
      ...singleTrend(123),
      values: { ...singleTrend(123).values, count: 2 },
    },
    {
      ...singleTrend(123),
      values: { ...singleTrend(123).values, max: 124 },
    },
  ]) {
    const securitySummary = globalThis.structuredClone(SECURITY_SUMMARY);
    if (metric === undefined)
      delete securitySummary.metrics.security_time_to_first_429_ms;
    else securitySummary.metrics.security_time_to_first_429_ms = metric;
    const harness = createHarness({ securitySummary });
    await assert.rejects(
      runCapacityWorkflow(options(), harness.deps),
      /security gate failed/,
    );
  }
});

test('security and smoke gates reject truncated or inconsistent metric structures', async () => {
  const truncatedSecurity = createHarness({
    securitySummary: {
      metrics: {
        security_auth_rejected_total: counter(10),
        security_rate_limited_total: {
          ...counter(5),
          thresholds: { 'count>0': { ok: true } },
        },
        security_unexpected_total: {
          type: 'counter',
          contains: 'default',
          values: { count: 0 },
          thresholds: { 'count==0': { ok: true } },
        },
      },
    },
  });
  await assert.rejects(
    runCapacityWorkflow(options(), truncatedSecurity.deps),
    /security gate failed/,
  );

  const inconsistentSmoke = createHarness({
    smokeSummary: {
      metrics: {
        checks: {
          ...rate(6, 1),
          values: { passes: 6, fails: 1, rate: 1 },
          thresholds: { 'rate==1': { ok: true } },
        },
        load_harness_failure: {
          ...rate(0, 1),
          thresholds: { 'rate==0': { ok: true } },
        },
      },
    },
  });
  await assert.rejects(
    runCapacityWorkflow(options(), inconsistentSmoke.deps),
    /smoke gate failed/,
  );
});

test('security and smoke gates reject negative, NaN, and missing metric values', async () => {
  const negativeSecurity = createHarness({
    securitySummary: {
      metrics: {
        security_auth_rejected_total: counter(10),
        security_rate_limited_total: {
          ...counter(-1, Number.NaN),
          thresholds: { 'count>0': { ok: true } },
        },
        security_unexpected_total: {
          ...counter(0, 0),
          thresholds: { 'count==0': { ok: true } },
        },
      },
    },
  });
  await assert.rejects(
    runCapacityWorkflow(options(), negativeSecurity.deps),
    /security gate failed/,
  );

  const missingSmoke = createHarness({
    smokeSummary: {
      metrics: {
        checks: {
          ...rate(7, 0),
          thresholds: { 'rate==1': { ok: true } },
        },
      },
    },
  });
  await assert.rejects(
    runCapacityWorkflow(options(), missingSmoke.deps),
    /smoke gate failed/,
  );

  const nanSmoke = createHarness({
    smokeSummary: {
      metrics: {
        checks: {
          ...rate(7, 0),
          values: { passes: 7, fails: 0, rate: Number.NaN },
          thresholds: { 'rate==1': { ok: true } },
        },
        load_harness_failure: {
          ...rate(0, 1),
          thresholds: { 'rate==0': { ok: true } },
        },
      },
    },
  });
  await assert.rejects(
    runCapacityWorkflow(options(), nanSmoke.deps),
    /smoke gate failed/,
  );
});

test('monitor and dedicated cleanup run in finally after an abort during probing', async () => {
  const controller = new globalThis.AbortController();
  const harness = createHarness({
    signal: controller.signal,
    abortOnFirstProbe: () => controller.abort(new Error('test abort')),
  });
  await assert.rejects(
    runCapacityWorkflow(options(), harness.deps),
    /workflow aborted/,
  );
  assert.deepEqual(harness.monitorCounts(), { starts: 1, stops: 1 });
  assert.deepEqual(harness.commands.at(-1).args, CLEANUP_ARGS);
});

test('a malformed capacity summary fails closed and still stops monitoring', async () => {
  const harness = createHarness({ probeSummary: () => ({ metrics: {} }) });
  await assert.rejects(
    runCapacityWorkflow(options(), harness.deps),
    /capacity summary parsing failed/,
  );
  assert.deepEqual(harness.monitorCounts(), { starts: 1, stops: 1 });
  assert.deepEqual(harness.commands.at(-1).args, CLEANUP_ARGS);
});

test('workflow and cleanup failures are both surfaced with safe fixed phases', async () => {
  const harness = createHarness({
    startupError: true,
    failFinalRuntimeCleanup: true,
    cleanupExitCodes: [0, 31],
  });
  await assert.rejects(
    runCapacityWorkflow(options(), harness.deps),
    (error) => {
      assert.match(
        error.message,
        /capacity stack startup failed \(status 17\)/,
      );
      assert.match(error.message, /runtime cleanup/);
      assert.match(error.message, /dedicated cleanup/);
      assert.doesNotMatch(error.message, /untrusted/);
      assert.equal(safeErrorMessage(error), error.message);
      return true;
    },
  );
});

test('cleanup-only failures are surfaced and all cleanup phases are attempted', async () => {
  const harness = createHarness({
    failFinalRuntimeCleanup: true,
    cleanupExitCodes: [0, 29],
  });
  await assert.rejects(
    runCapacityWorkflow(options({ mode: 'smoke', maxVus: 1 }), harness.deps),
    (error) => {
      assert.match(error.message, /cleanup failed/);
      assert.match(error.message, /runtime cleanup/);
      assert.match(error.message, /dedicated cleanup/);
      assert.doesNotMatch(error.message, /untrusted/);
      return true;
    },
  );
  assert.equal(
    harness.commands.filter(({ args }) => args.includes('down')).length,
    2,
  );
});

test('safeErrorMessage never exposes arbitrary error content', () => {
  const secret = 'secret-message-that-must-not-escape';
  assert.equal(safeErrorMessage(new TypeError(secret)), 'configuration failed');
  assert.equal(
    safeErrorMessage(new Error(secret)),
    'unexpected load-test harness error',
  );
});

test('the real command runner captures bounded stdout only when requested', async () => {
  const earliestStart = Date.now();
  const captured = await nodeDependencies.runCommand(
    process.execPath,
    ['-e', "process.stdout.write('synthetic-monitor-output')"],
    { captureStdout: true },
  );
  const discarded = await nodeDependencies.runCommand(process.execPath, [
    '-e',
    "process.stdout.write('discarded-command-output')",
  ]);
  assert.equal(captured.exitCode, 0);
  assert.equal(captured.stdout, 'synthetic-monitor-output');
  assert.equal(captured.stderr, '');
  assert.ok(captured.startedAtMs >= earliestStart);
  assert.ok(captured.startedAtMs <= Date.now());
  assert.equal(discarded.stdout, '');
});

test('abort signals wait for child close and escalate to SIGKILL without leaking the reason', async () => {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  const killedWith = [];
  child.kill = (signal) => {
    killedWith.push(signal);
    return true;
  };
  let timerCallback;
  let clearedTimer;
  const timerToken = Object.freeze({ timer: true });
  const runCommand = createCommandRunner({
    spawnProcess: () => child,
    now: () => 123,
    setTimer(callback, delay) {
      assert.equal(delay, 5_000);
      timerCallback = callback;
      return timerToken;
    },
    clearTimer(token) {
      clearedTimer = token;
    },
    currentWorkingDirectory: () => '/safe/workspace',
    environmentForChild: () => ({}),
  });
  const controller = new globalThis.AbortController();
  let cleanupStarted = false;
  const execution = runCommand('synthetic-command', [], {
    signal: controller.signal,
  });
  const observed = execution.finally(() => {
    cleanupStarted = true;
  });

  controller.abort(new Error(`untrusted abort ${SECRET_FRAGMENT}`));
  await new Promise((resolve) => globalThis.setImmediate(resolve));
  assert.deepEqual(killedWith, ['SIGTERM']);
  assert.equal(cleanupStarted, false);

  timerCallback();
  assert.deepEqual(killedWith, ['SIGTERM', 'SIGKILL']);
  child.emit('error', new Error(`untrusted child ${SECRET_FRAGMENT}`));
  assert.equal(cleanupStarted, false);
  child.emit('close', null);

  await assert.rejects(observed, (error) => {
    assert.equal(error.message, 'command aborted');
    assert.doesNotMatch(error.message, new RegExp(SECRET_FRAGMENT));
    return true;
  });
  assert.equal(cleanupStarted, true);
  assert.equal(clearedTimer, timerToken);
});

test('the real command runner scrubs malicious host runtime-secret precedence', async () => {
  const secretKeys = [
    'ADMIN_PASSWORD',
    'DB_PASSWORD',
    'LOAD_USER_PASSWORD',
    'JWKS_ENCRYPTION_KEY',
    'OTP_TOKEN_SECRET',
    'OIDC_COOKIE_KEYS',
    'SERVICE_CLIENT_SECRET',
  ];
  const previous = Object.fromEntries(
    secretKeys.map((key) => [key, process.env[key]]),
  );
  try {
    for (const key of secretKeys) process.env[key] = `malicious-${key}`;
    const result = await nodeDependencies.runCommand(
      process.execPath,
      [
        '-e',
        `process.stdout.write(JSON.stringify(${JSON.stringify(secretKeys)}.map((key) => Object.hasOwn(process.env, key))))`,
      ],
      {
        captureStdout: true,
        env: {
          LOAD_HTTP_THROTTLE_LIMIT: '120',
          LOAD_LOGIN_RATE_LIMIT_IP_MAX: '10',
        },
      },
    );
    assert.deepEqual(
      JSON.parse(result.stdout),
      secretKeys.map(() => false),
    );
  } finally {
    for (const key of secretKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test('child environment replaces malicious host IDs with validated computed IDs', () => {
  const environment = createChildEnvironment(
    {
      SAFE_PARENT_VALUE: 'preserved',
      LOAD_TEST_UID: '4294967295',
      LOAD_TEST_GID: '-1',
    },
    {},
    { LOAD_TEST_UID: '12345', LOAD_TEST_GID: '23456' },
  );

  assert.equal(environment.SAFE_PARENT_VALUE, 'preserved');
  assert.equal(environment.LOAD_TEST_UID, '12345');
  assert.equal(environment.LOAD_TEST_GID, '23456');
  assert.throws(
    () =>
      createChildEnvironment(
        {},
        {},
        {
          LOAD_TEST_UID: 'not-an-id',
          LOAD_TEST_GID: '23456',
        },
      ),
    /invalid computed load-test identity/,
  );
});

test('the real command runner injects process ownership instead of host ID overrides', async () => {
  const previousUid = process.env.LOAD_TEST_UID;
  const previousGid = process.env.LOAD_TEST_GID;
  try {
    process.env.LOAD_TEST_UID = '4294967295';
    process.env.LOAD_TEST_GID = '-1';
    const result = await nodeDependencies.runCommand(
      process.execPath,
      [
        '-e',
        'process.stdout.write(JSON.stringify([process.env.LOAD_TEST_UID, process.env.LOAD_TEST_GID]))',
      ],
      { captureStdout: true },
    );
    const expected = [
      typeof process.getuid === 'function' ? String(process.getuid()) : null,
      typeof process.getgid === 'function' ? String(process.getgid()) : null,
    ];
    assert.deepEqual(
      JSON.parse(result.stdout).map((value) => value ?? null),
      expected,
    );
  } finally {
    if (previousUid === undefined) delete process.env.LOAD_TEST_UID;
    else process.env.LOAD_TEST_UID = previousUid;
    if (previousGid === undefined) delete process.env.LOAD_TEST_GID;
    else process.env.LOAD_TEST_GID = previousGid;
  }
});
