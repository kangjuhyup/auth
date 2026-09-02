import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import test from 'node:test';
import { parseOptions } from '../lib/config.mjs';
import { runCapacityWorkflow, safeErrorMessage } from '../lib/orchestrator.mjs';
import { nodeDependencies } from '../run-capacity.mjs';

const SECRET_FRAGMENT = '07070707';

function trend(count = 1, p95 = 100, p99 = 200) {
  return { values: { count, 'p(95)': p95, 'p(99)': p99 } };
}

function capacitySummary({ passed = true, soakSeconds } = {}) {
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
    const metrics = {};
    for (let minute = 0; minute < Math.ceil(soakSeconds / 60); minute += 1) {
      metrics[`load_request_failed{minute:${minute}}`] = {
        values: { count: 1, rate: passed ? 0 : 0.02 },
      };
      metrics[`load_check_failed{minute:${minute}}`] = {
        values: { count: 1, rate: 0 },
      };
      metrics[`load_http_req_duration_ms{minute:${minute}}`] = trend();
      for (const endpoint of endpointNames)
        metrics[`load_${endpoint}_duration_ms{minute:${minute}}`] = trend();
    }
    return { metrics };
  }
  return {
    metrics: {
      load_request_failed: { values: { count: 1, rate: passed ? 0 : 0.02 } },
      load_check_failed: { values: { count: 1, rate: 0 } },
      load_http_req_duration_ms: trend(),
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
    security_auth_rejected_total: { values: { count: 10 } },
    security_rate_limited_total: {
      values: { count: 5 },
      thresholds: { 'count>0': { ok: true } },
    },
    security_unexpected_total: {
      values: { count: 0 },
      thresholds: { 'count==0': { ok: true } },
    },
  },
});

const SMOKE_SUMMARY = Object.freeze({
  metrics: {
    checks: {
      values: { count: 7, passes: 7, fails: 0, rate: 1 },
      thresholds: { 'rate==1': { ok: true } },
    },
    load_harness_failure: {
      values: { count: 1, rate: 0 },
      thresholds: { 'rate==0': { ok: true } },
    },
  },
});

function envValue(args, name) {
  const prefix = `${name}=`;
  return args.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function createHarness({
  probePasses = () => true,
  probeSummary,
  securitySummary = SECURITY_SUMMARY,
  missingSummaryScript,
  abortOnFirstProbe,
  soakMonitorSamples = [],
  signal,
} = {}) {
  const commands = [];
  const events = [];
  const files = new Map();
  let resultDirectory;
  let monitorStarts = 0;
  let monitorStops = 0;
  let probeCount = 0;
  const monitorSamples = [];

  const deps = {
    signal,
    async runCommand(file, args, options = {}) {
      commands.push({ file, args: [...args], options });
      events.push({ kind: 'command', file, args: [...args], options });
      const script = args.at(-1);
      if (script === '/scripts/provision.js')
        return { exitCode: 0, stdout: '', stderr: '' };
      if (script?.startsWith('/scripts/')) {
        const containerSummaryPath = envValue(args, 'SUMMARY_PATH');
        if (missingSummaryScript === script)
          return { exitCode: 1, stdout: '', stderr: 'sensitive stderr' };
        const summaryName = containerSummaryPath.split('/').at(-1);
        let raw;
        if (script === '/scripts/rate-limit.js') raw = securitySummary;
        else if (script === '/scripts/smoke.js') raw = SMOKE_SUMMARY;
        else {
          probeCount += 1;
          if (abortOnFirstProbe && probeCount === 1) abortOnFirstProbe();
          const runKind = envValue(args, 'RUN_KIND');
          const vus = Number(envValue(args, 'VUS'));
          if (runKind === 'soak') monitorSamples.push(...soakMonitorSamples);
          raw =
            runKind === 'soak'
              ? capacitySummary({
                  passed: true,
                  soakSeconds: Number(envValue(args, 'SOAK_SECONDS')),
                })
              : (probeSummary?.(vus) ??
                capacitySummary({ passed: probePasses(vus) }));
        }
        files.set(`${resultDirectory}/${summaryName}`, JSON.stringify(raw));
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    },
    async fetchHealth() {
      return true;
    },
    startMonitor(_monitorDeps, path) {
      monitorStarts += 1;
      events.push({ kind: 'monitor-start', path });
      return {
        snapshot: () => monitorSamples.slice(),
        async stop() {
          monitorStops += 1;
          events.push({ kind: 'monitor-stop' });
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
    },
    async chmod(path, mode) {
      events.push({ kind: 'chmod', path, mode });
    },
    async rm(path) {
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
});

test('all coarse levels passing reports an observed lower bound', async () => {
  const harness = createHarness();
  const report = await runCapacityWorkflow(
    options({ maxVus: 25 }),
    harness.deps,
  );
  assert.equal(report.capacity.lastPassingVus, 25);
  assert.equal(report.capacity.firstFailingVus, null);
  assert.equal(report.capacity.atLeast, true);
  assert.match(harness.files.get(report.summaryPath), /at least 25 VUs/);
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
});

test('soak reports the first minute with an exact auth-service restart sample', async () => {
  const harness = createHarness({
    soakMonitorSamples: [
      {
        timestamp: '2026-09-02T01:03:03.004Z',
        services: { 'auth-service': { restartCount: 1 } },
        dependencyErrors: 0,
      },
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

test('safeErrorMessage never exposes arbitrary error content', () => {
  const secret = 'secret-message-that-must-not-escape';
  assert.equal(safeErrorMessage(new TypeError(secret)), 'configuration failed');
  assert.equal(
    safeErrorMessage(new Error(secret)),
    'unexpected load-test harness error',
  );
});

test('the real command runner captures bounded stdout only when requested', async () => {
  const captured = await nodeDependencies.runCommand(
    process.execPath,
    ['-e', "process.stdout.write('synthetic-monitor-output')"],
    { captureStdout: true },
  );
  const discarded = await nodeDependencies.runCommand(process.execPath, [
    '-e',
    "process.stdout.write('discarded-command-output')",
  ]);
  assert.deepEqual(captured, {
    exitCode: 0,
    stdout: 'synthetic-monitor-output',
    stderr: '',
  });
  assert.equal(discarded.stdout, '');
});
