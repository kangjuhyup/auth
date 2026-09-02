import {
  buildCoarseLevels,
  DEFAULT_SLO,
  evaluateCapacityMetrics,
  nextRefinementLevel,
} from './capacity.mjs';
import { assertLocalTarget, createRuntimeEnvironment } from './config.mjs';
import {
  normalizeK6Summary,
  normalizeSoakWindows,
  renderSummaryMarkdown,
  sanitizeEnvironment,
} from './report.mjs';

const COMPOSE_BASE = Object.freeze([
  'compose',
  '--project-name',
  'auth-load',
  '-f',
  'docker-compose.load.yml',
]);
const CLEANUP_ARGS = Object.freeze([
  ...COMPOSE_BASE,
  'down',
  '--volumes',
  '--remove-orphans',
]);
const RUNTIME_ENV_PATH = 'load-tests/.runtime.env';
const HEALTH_URL = 'http://127.0.0.1:13000/health';
const CAPACITY_PROFILE = Object.freeze({
  LOAD_HTTP_THROTTLE_LIMIT: '1000000',
  LOAD_LOGIN_RATE_LIMIT_IP_MAX: '100000',
});
const SECURITY_PROFILE = Object.freeze({
  LOAD_HTTP_THROTTLE_LIMIT: '120',
  LOAD_LOGIN_RATE_LIMIT_IP_MAX: '10',
});

class HarnessError extends Error {
  constructor(phase, status = undefined) {
    super(
      status === undefined
        ? `${phase} failed`
        : `${phase} failed (status ${status})`,
    );
    this.name = 'HarnessError';
    this.phase = phase;
    this.status = status;
  }
}

function validateOptions(options) {
  if (!options || typeof options !== 'object')
    throw new HarnessError('configuration');
  for (const [name, value] of Object.entries({
    maxVus: options.maxVus,
    warmupSeconds: options.warmupSeconds,
    measureSeconds: options.measureSeconds,
    soakSeconds: options.soakSeconds,
  })) {
    if (!Number.isSafeInteger(value) || value < 1)
      throw new HarnessError('configuration');
    if (name === 'soakSeconds' && value > 1800)
      throw new HarnessError('configuration');
  }
  if (!['capacity', 'smoke'].includes(options.mode))
    throw new HarnessError('configuration');
  if (typeof options.allowRemoteTarget !== 'boolean')
    throw new HarnessError('configuration');
  assertLocalTarget(HEALTH_URL);
}

function validateDependencies(deps) {
  for (const name of [
    'runCommand',
    'fetchHealth',
    'startMonitor',
    'now',
    'randomBytes',
    'writeFile',
    'readFile',
    'mkdir',
    'chmod',
    'rm',
  ]) {
    if (typeof deps?.[name] !== 'function')
      throw new HarnessError('dependency configuration');
  }
}

function timestampDirectoryName(now) {
  const value = now();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime()))
    throw new HarnessError('clock');
  return value.toISOString().replace(/[:.]/g, '-');
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw new HarnessError('workflow aborted');
}

async function runCommand(
  deps,
  args,
  phase,
  options = {},
  { allowFailure = false } = {},
) {
  throwIfAborted(options.signal);
  let result;
  try {
    result = await deps.runCommand('docker', args, options);
  } catch {
    if (options.signal?.aborted) throw new HarnessError('workflow aborted');
    throw new HarnessError(phase);
  }
  if (!result || !Number.isSafeInteger(result.exitCode))
    throw new HarnessError(phase);
  if (!allowFailure && result.exitCode !== 0)
    throw new HarnessError(phase, result.exitCode);
  return result;
}

async function cleanupCommand(deps) {
  let result;
  try {
    result = await deps.runCommand('docker', [...CLEANUP_ARGS], {});
  } catch {
    throw new HarnessError('dedicated cleanup');
  }
  if (!result || result.exitCode !== 0) {
    throw new HarnessError(
      'dedicated cleanup',
      Number.isSafeInteger(result?.exitCode) ? result.exitCode : undefined,
    );
  }
}

async function waitForHealth(deps) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    throwIfAborted(deps.signal);
    try {
      const response = await deps.fetchHealth(HEALTH_URL, {
        signal: deps.signal,
      });
      if (response === true || response?.ok === true) return;
    } catch {
      if (deps.signal?.aborted) throw new HarnessError('workflow aborted');
    }
    await (
      deps.sleep ??
      ((milliseconds) =>
        new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds)))
    )(1_000);
  }
  throw new HarnessError('health check');
}

function composeWithRuntime() {
  return [...COMPOSE_BASE, '--env-file', RUNTIME_ENV_PATH];
}

function controlEnvironment(values) {
  const result = [];
  for (const [name, value] of Object.entries(values)) {
    if (
      !/^[A-Z][A-Z0-9_]*$/.test(name) ||
      !/^[A-Za-z0-9._/-]+$/.test(String(value))
    ) {
      throw new HarnessError('k6 control configuration');
    }
    result.push('-e', `${name}=${value}`);
  }
  return result;
}

async function readJson(deps, path, phase) {
  let text;
  try {
    text = await deps.readFile(path, 'utf8');
  } catch {
    throw new HarnessError(phase);
  }
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error();
    return parsed;
  } catch {
    throw new HarnessError(phase);
  }
}

async function runK6(
  deps,
  resultDirectory,
  {
    script,
    summaryName,
    controls,
    phase,
    profile = CAPACITY_PROFILE,
    summaryRequired = true,
  },
) {
  const summaryPath = summaryName
    ? `${resultDirectory}/${summaryName}`
    : undefined;
  if (summaryPath) await deps.rm(summaryPath, { force: true });
  const controlValues = summaryName
    ? { ...controls, SUMMARY_PATH: `/results/${summaryName}` }
    : controls;
  const args = [
    ...composeWithRuntime(),
    'run',
    '--rm',
    '--no-deps',
    ...controlEnvironment(controlValues),
    'k6',
    'run',
    script,
  ];
  const result = await runCommand(
    deps,
    args,
    phase,
    { env: { ...profile }, signal: deps.signal },
    { allowFailure: true },
  );
  let raw;
  if (summaryRequired) raw = await readJson(deps, summaryPath, phase);
  if (result.exitCode !== 0) throw new HarnessError(phase, result.exitCode);
  return { raw, summaryPath, startedAtMs: result.startedAtMs };
}

function thresholdPassed(metric, expression) {
  return metric?.thresholds?.[expression]?.ok === true;
}

function boundedCounterMetric(raw, name) {
  const metric = raw?.metrics?.[name];
  const count = metric?.values?.count;
  const rate = metric?.values?.rate;
  if (
    metric?.type !== 'counter' ||
    metric.contains !== 'default' ||
    !Number.isSafeInteger(count) ||
    count < 0 ||
    typeof rate !== 'number' ||
    !Number.isFinite(rate) ||
    rate < 0
  ) {
    throw new HarnessError(
      name.includes('security_') ? 'security gate' : 'metric gate',
    );
  }
  return metric;
}

function boundedRateMetric(raw, name, phase) {
  const metric = raw?.metrics?.[name];
  const passes = metric?.values?.passes;
  const fails = metric?.values?.fails;
  const rate = metric?.values?.rate;
  const total = passes + fails;
  if (
    metric?.type !== 'rate' ||
    metric.contains !== 'default' ||
    !Number.isSafeInteger(passes) ||
    passes < 0 ||
    !Number.isSafeInteger(fails) ||
    fails < 0 ||
    !Number.isSafeInteger(total) ||
    total < 1 ||
    typeof rate !== 'number' ||
    !Number.isFinite(rate) ||
    rate < 0 ||
    rate > 1 ||
    Math.abs(rate - passes / total) > 1e-12
  ) {
    throw new HarnessError(phase);
  }
  return metric;
}

function requireSecurityGate(raw) {
  const rejected = boundedCounterMetric(raw, 'security_auth_rejected_total');
  const limited = boundedCounterMetric(raw, 'security_rate_limited_total');
  const unexpected = boundedCounterMetric(raw, 'security_unexpected_total');
  if (
    rejected.values.count < 0 ||
    !Number.isFinite(limited?.values?.count) ||
    limited.values.count <= 0 ||
    !Number.isFinite(unexpected?.values?.count) ||
    unexpected.values.count !== 0 ||
    !thresholdPassed(limited, 'count>0') ||
    !thresholdPassed(unexpected, 'count==0')
  ) {
    throw new HarnessError('security gate');
  }
}

function requireSmokeGate(raw) {
  const checks = boundedRateMetric(raw, 'checks', 'smoke gate');
  const harness = boundedRateMetric(raw, 'load_harness_failure', 'smoke gate');
  if (
    checks.values.rate !== 1 ||
    checks.values.passes < 1 ||
    checks.values.fails !== 0 ||
    harness.values.rate !== 0 ||
    harness.values.passes !== 0 ||
    !thresholdPassed(checks, 'rate==1') ||
    !thresholdPassed(harness, 'rate==0')
  ) {
    throw new HarnessError('smoke gate');
  }
}

function monitorSnapshot(monitor) {
  if (!monitor || typeof monitor.snapshot !== 'function') return [];
  const samples = monitor.snapshot();
  if (!Array.isArray(samples)) throw new HarnessError('monitor snapshot');
  return samples;
}

function contextFromSamples(samples) {
  let serviceRestarted = false;
  let dependencyErrors = 0;
  for (const sample of samples) {
    const restartCount = sample?.services?.['auth-service']?.restartCount;
    if (
      restartCount !== undefined &&
      (!Number.isSafeInteger(restartCount) || restartCount < 0)
    ) {
      throw new HarnessError('monitor snapshot');
    }
    if (restartCount > 0) serviceRestarted = true;
    const errors = sample?.dependencyErrors ?? 0;
    if (!Number.isSafeInteger(errors) || errors < 0)
      throw new HarnessError('monitor snapshot');
    dependencyErrors = Math.max(dependencyErrors, errors);
  }
  return { serviceRestarted, dependencyErrors };
}

function monitorSamplesSince(monitor, startIndex) {
  return monitorSnapshot(monitor).slice(startIndex);
}

async function runProbe(deps, monitor, resultDirectory, options, vus, phase) {
  const sampleIndex = monitorSnapshot(monitor).length;
  const fileName = `${phase}-${vus}.json`;
  const { raw, summaryPath } = await runK6(deps, resultDirectory, {
    script: '/scripts/journey.js',
    summaryName: fileName,
    controls: {
      VUS: vus,
      WARMUP_SECONDS: options.warmupSeconds,
      MEASURE_SECONDS: options.measureSeconds,
      SOAK_SECONDS: options.soakSeconds,
      RUN_KIND: 'probe',
    },
    phase: 'capacity probe',
  });
  let metrics;
  try {
    metrics = normalizeK6Summary(
      raw,
      contextFromSamples(monitorSamplesSince(monitor, sampleIndex)),
    );
  } catch {
    throw new HarnessError('capacity summary parsing');
  }
  const evaluation = evaluateCapacityMetrics(metrics);
  return { phase, vus, summaryPath, metrics, evaluation };
}

export function bucketMonitorSamples(
  samples,
  { measurementStartMs, measurementDurationMs, bucketCount },
) {
  if (
    !Array.isArray(samples) ||
    !Number.isSafeInteger(measurementStartMs) ||
    !Number.isSafeInteger(measurementDurationMs) ||
    measurementDurationMs < 1 ||
    !Number.isSafeInteger(bucketCount) ||
    bucketCount !== Math.ceil(measurementDurationMs / 60_000)
  ) {
    throw new HarnessError('monitor timing');
  }
  const measurementEndMs = measurementStartMs + measurementDurationMs;
  if (!Number.isSafeInteger(measurementEndMs))
    throw new HarnessError('monitor timing');
  const buckets = Array.from({ length: bucketCount }, () => []);
  for (const sample of samples) {
    const sampledAtMs = Date.parse(sample?.timestamp);
    if (!Number.isFinite(sampledAtMs)) throw new HarnessError('monitor timing');
    if (sampledAtMs < measurementStartMs || sampledAtMs > measurementEndMs)
      continue;
    const minute = Math.min(
      bucketCount - 1,
      Math.floor((sampledAtMs - measurementStartMs) / 60_000),
    );
    buckets[minute].push(sample);
  }
  return buckets;
}

async function runSoak(deps, monitor, resultDirectory, options, vus) {
  const sampleIndex = monitorSnapshot(monitor).length;
  const measurementDurationMs = options.soakSeconds * 1_000;
  const { raw, summaryPath, startedAtMs } = await runK6(deps, resultDirectory, {
    script: '/scripts/journey.js',
    summaryName: 'soak-raw.json',
    controls: {
      VUS: vus,
      WARMUP_SECONDS: options.warmupSeconds,
      MEASURE_SECONDS: options.soakSeconds,
      SOAK_SECONDS: options.soakSeconds,
      RUN_KIND: 'soak',
    },
    phase: 'soak run',
  });
  if (!Number.isSafeInteger(startedAtMs)) throw new HarnessError('soak timing');
  const measurementStartMs = startedAtMs + options.warmupSeconds * 1_000;
  if (!Number.isSafeInteger(measurementStartMs))
    throw new HarnessError('soak timing');
  const bucketCount = Math.ceil(options.soakSeconds / 60);
  const monitorBuckets = bucketMonitorSamples(
    monitorSamplesSince(monitor, sampleIndex),
    { measurementStartMs, measurementDurationMs, bucketCount },
  );
  let normalized;
  try {
    normalized = normalizeSoakWindows(raw, {
      soakSeconds: options.soakSeconds,
    });
  } catch {
    throw new HarnessError('soak summary parsing');
  }
  const windows = normalized.map(({ minute, metrics }) => {
    const context = contextFromSamples(monitorBuckets[minute]);
    const withContext = {
      ...metrics,
      serviceRestarted: context.serviceRestarted,
      dependencyErrors: context.dependencyErrors,
    };
    return {
      minute,
      metrics: withContext,
      evaluation: evaluateCapacityMetrics(withContext),
    };
  });
  const firstViolation = windows.find(({ evaluation }) => !evaluation.passed);
  return {
    ran: true,
    vus,
    summaryPath,
    windows,
    passed: firstViolation === undefined,
    firstViolationMinute: firstViolation?.minute ?? null,
    measurementStartedAt: new Date(measurementStartMs).toISOString(),
    measurementEndedAt: new Date(
      measurementStartMs + measurementDurationMs,
    ).toISOString(),
  };
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function renderCapacitySection(capacity, soak, soakSeconds) {
  const conclusion = capacity.atLeast
    ? `Highest probe-passing level: at least ${capacity.lastPassingVus} VUs (search cap)`
    : `Highest probe-passing level: ${capacity.lastPassingVus} VUs`;
  const firstFailure =
    capacity.firstFailingVus === null
      ? 'not observed'
      : `${capacity.firstFailingVus} VUs`;
  const rows = capacity.probes.map(
    ({ phase, vus, evaluation }) =>
      `| ${phase} | ${vus} | ${evaluation.passed ? 'PASS' : 'FAIL'} |`,
  );
  const soakConclusion = soak.ran
    ? `Soak endurance: ${soak.passed ? 'PASS' : 'FAIL'} at ${soak.vus} VUs for ${soakSeconds} seconds`
    : 'Soak endurance: NOT RUN (no probe-passing VU)';
  return [
    '## Capacity search',
    '',
    conclusion,
    `First failing level: ${firstFailure}`,
    soakConclusion,
    '',
    '| Phase | VUs | SLO |',
    '| --- | ---: | --- |',
    ...rows,
    '',
  ].join('\n');
}

async function executeWorkflow(options, deps, resultDirectory, environment) {
  await deps.mkdir(resultDirectory, { recursive: true, mode: 0o700 });
  const runtime = createRuntimeEnvironment(options, deps.randomBytes);
  await deps.writeFile(RUNTIME_ENV_PATH, runtime.text, {
    mode: 0o600,
    flag: 'wx',
  });
  await deps.chmod(RUNTIME_ENV_PATH, 0o600);
  const safeEnvironment = sanitizeEnvironment({
    ...runtime.safe,
    target: 'http://auth-service:3000',
  });
  await deps.writeFile(
    `${resultDirectory}/environment.json`,
    json(safeEnvironment),
    { mode: 0o600 },
  );

  await runCommand(
    deps,
    [
      ...composeWithRuntime(),
      'up',
      '-d',
      '--build',
      'postgres-load',
      'redis-load',
      'auth-service',
    ],
    'capacity stack startup',
    { env: { ...CAPACITY_PROFILE }, signal: deps.signal },
  );
  await waitForHealth(deps);
  await runK6(deps, resultDirectory, {
    script: '/scripts/provision.js',
    controls: { MAX_VUS: options.maxVus },
    phase: 'provisioning',
    summaryRequired: false,
  });

  await runCommand(
    deps,
    [
      ...composeWithRuntime(),
      'up',
      '-d',
      '--force-recreate',
      '--no-deps',
      'auth-service',
    ],
    'security profile startup',
    { env: { ...SECURITY_PROFILE }, signal: deps.signal },
  );
  await waitForHealth(deps);
  const security = await runK6(deps, resultDirectory, {
    script: '/scripts/rate-limit.js',
    summaryName: 'security.json',
    controls: {},
    phase: 'security gate',
    profile: SECURITY_PROFILE,
  });
  requireSecurityGate(security.raw);

  await runCommand(
    deps,
    [
      ...composeWithRuntime(),
      'up',
      '-d',
      '--force-recreate',
      '--no-deps',
      'auth-service',
    ],
    'capacity profile startup',
    { env: { ...CAPACITY_PROFILE }, signal: deps.signal },
  );
  await waitForHealth(deps);
  const smoke = await runK6(deps, resultDirectory, {
    script: '/scripts/smoke.js',
    summaryName: 'smoke.json',
    controls: {
      VUS: 1,
      WARMUP_SECONDS: options.warmupSeconds,
      MEASURE_SECONDS: options.measureSeconds,
      SOAK_SECONDS: options.soakSeconds,
      RUN_KIND: 'smoke',
    },
    phase: 'smoke gate',
  });
  requireSmokeGate(smoke.raw);

  if (options.mode === 'smoke') {
    return Object.freeze({
      mode: 'smoke',
      environment: safeEnvironment,
      summaryPath: smoke.summaryPath,
    });
  }

  const monitor = deps.startMonitor(
    deps,
    `${resultDirectory}/docker-stats.csv`,
  );
  environment.monitor = monitor;
  if (
    !monitor ||
    typeof monitor.ready !== 'function' ||
    typeof monitor.snapshot !== 'function' ||
    typeof monitor.stop !== 'function'
  ) {
    throw new HarnessError('monitor readiness');
  }
  try {
    const readiness = monitor.ready();
    if (!readiness || typeof readiness.then !== 'function') {
      throw new Error('Invalid monitor readiness result');
    }
    await readiness;
  } catch {
    throw new HarnessError('monitor readiness');
  }
  throwIfAborted(deps.signal);
  const probes = [];
  let lastPassingVus = 0;
  let firstFailingVus = null;
  for (const vus of buildCoarseLevels(options.maxVus)) {
    throwIfAborted(deps.signal);
    const probe = await runProbe(
      deps,
      monitor,
      resultDirectory,
      options,
      vus,
      'coarse',
    );
    probes.push(probe);
    if (!probe.evaluation.passed) {
      firstFailingVus = vus;
      break;
    }
    lastPassingVus = vus;
  }
  while (firstFailingVus !== null) {
    const vus = nextRefinementLevel(lastPassingVus, firstFailingVus);
    if (vus === null) break;
    throwIfAborted(deps.signal);
    const probe = await runProbe(
      deps,
      monitor,
      resultDirectory,
      options,
      vus,
      'refine',
    );
    probes.push(probe);
    if (probe.evaluation.passed) lastPassingVus = vus;
    else firstFailingVus = vus;
  }

  const capacity = {
    probes,
    lastPassingVus,
    firstFailingVus,
    atLeast: firstFailingVus === null && lastPassingVus === options.maxVus,
  };
  const soak =
    lastPassingVus > 0
      ? await runSoak(deps, monitor, resultDirectory, options, lastPassingVus)
      : {
          ran: false,
          vus: 0,
          windows: [],
          passed: false,
          firstViolationMinute: null,
        };
  const passed = lastPassingVus > 0 && soak.passed;
  const representativeMetrics =
    soak.windows.find(({ evaluation }) => !evaluation.passed)?.metrics ??
    soak.windows.at(-1)?.metrics ??
    probes.at(-1)?.metrics;
  const report = {
    mode: 'capacity',
    environment: safeEnvironment,
    slo: DEFAULT_SLO,
    passed,
    metrics: representativeMetrics,
    firstViolationMinute: soak.firstViolationMinute,
    capacity,
    soak,
    summaryPath: `${resultDirectory}/summary.md`,
  };
  await deps.writeFile(`${resultDirectory}/capacity.json`, json(capacity), {
    mode: 0o600,
  });
  await deps.writeFile(`${resultDirectory}/soak.json`, json(soak), {
    mode: 0o600,
  });
  await deps.writeFile(
    report.summaryPath,
    `${renderSummaryMarkdown(report)}\n${renderCapacitySection(capacity, soak, options.soakSeconds)}`,
    { mode: 0o600 },
  );
  return Object.freeze(report);
}

export async function runCapacityWorkflow(options, deps) {
  let workflowError;
  let cleanupError;
  let report;
  const state = { monitor: undefined };
  try {
    validateDependencies(deps);
    validateOptions(options);
    await cleanupCommand(deps);
    await deps.rm(RUNTIME_ENV_PATH, { force: true });
    const resultDirectory = `load-tests/results/${timestampDirectoryName(deps.now)}`;
    report = await executeWorkflow(options, deps, resultDirectory, state);
  } catch (error) {
    workflowError =
      error instanceof HarnessError ? error : new HarnessError('workflow');
  } finally {
    if (state.monitor) {
      try {
        await state.monitor.stop();
      } catch {
        cleanupError = new HarnessError('monitor shutdown');
      }
    }
    try {
      await deps?.rm?.(RUNTIME_ENV_PATH, { force: true });
    } catch {
      cleanupError ??= new HarnessError('runtime cleanup');
    }
    try {
      if (typeof deps?.runCommand === 'function') await cleanupCommand(deps);
    } catch (error) {
      cleanupError ??= error;
    }
  }
  if (workflowError) throw workflowError;
  if (cleanupError) throw cleanupError;
  return report;
}

export function safeErrorMessage(error) {
  if (error instanceof HarnessError) return error.message;
  if (error instanceof TypeError || error instanceof RangeError)
    return 'configuration failed';
  return 'unexpected load-test harness error';
}
