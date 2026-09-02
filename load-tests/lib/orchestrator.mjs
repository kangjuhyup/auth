import {
  buildCoarseLevels,
  DEFAULT_SLO,
  evaluateCapacityMetrics,
  nextRefinementLevel,
} from './capacity.mjs';
import { assertLocalTarget, createRuntimeEnvironment } from './config.mjs';
import { summarizeMonitorSamples } from './monitor.mjs';
import {
  normalizeK6Summary,
  normalizeMeasurementEpoch,
  normalizeSoakWindows,
  parseDockerComposeVersion,
  parseDockerServerVersion,
  parseServiceImageRecord,
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
const K6_IMAGE = 'grafana/k6:2.2.0';
const EXPECTED_SERVICES = Object.freeze([
  'auth-service',
  'postgres-load',
  'redis-load',
]);
const TRAFFIC_MIX = Object.freeze({
  introspection: 45,
  userinfo: 25,
  refresh: 12,
  discovery: 8,
  jwks: 5,
  relogin: 5,
});
const SERVICE_IMAGE_FORMAT = [
  '{{json .Id}}',
  '{{json .Image}}',
  '{{json (index .Config.Labels "com.docker.compose.project")}}',
  '{{json (index .Config.Labels "com.docker.compose.service")}}',
].join('\t');
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

class CleanupHarnessError extends Error {
  constructor(phases) {
    super(`cleanup failed (${phases.join('; ')})`);
    this.name = 'CleanupHarnessError';
    this.phases = Object.freeze([...phases]);
  }
}

class CombinedHarnessError extends Error {
  constructor(primary, cleanup) {
    super(`${primary.message}; ${cleanup.message}`);
    this.name = 'CombinedHarnessError';
    this.primary = primary;
    this.cleanup = cleanup;
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
    'systemInfo',
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

async function capturedCommand(deps, args, phase) {
  const result = await runCommand(deps, args, phase, {
    captureStdout: true,
    signal: deps.signal,
  });
  if (typeof result.stdout !== 'string') throw new HarnessError(phase);
  return result.stdout;
}

async function collectEnvironment(deps, runtimeSafe) {
  let host;
  try {
    host = deps.systemInfo();
  } catch {
    throw new HarnessError('host metadata');
  }
  const dockerVersionOutput = await capturedCommand(
    deps,
    ['version', '--format', '{{json .Server.Version}}'],
    'Docker metadata',
  );
  const composeVersionOutput = await capturedCommand(
    deps,
    [...COMPOSE_BASE, 'version', '--short'],
    'Compose metadata',
  );
  const containerOutput = await capturedCommand(
    deps,
    [...composeWithRuntime(), 'ps', '--all', '-q', 'auth-service'],
    'service image metadata',
  );
  if (
    !/^[a-f0-9]{64}\r?\n?$/.test(containerOutput) ||
    containerOutput.trim().length !== 64
  ) {
    throw new HarnessError('service image metadata');
  }
  const containerId = containerOutput.trim();
  const imageOutput = await capturedCommand(
    deps,
    ['inspect', '--format', SERVICE_IMAGE_FORMAT, containerId],
    'service image metadata',
  );
  try {
    const image = parseServiceImageRecord(imageOutput);
    if (image.containerId !== containerId)
      throw new TypeError('container identity mismatch');
    return sanitizeEnvironment({
      ...runtimeSafe,
      target: 'http://auth-service:3000',
      host,
      docker: {
        version: parseDockerServerVersion(dockerVersionOutput),
        composeVersion: parseDockerComposeVersion(composeVersionOutput),
      },
      k6Image: K6_IMAGE,
      serviceImage: image.serviceImage,
    });
  } catch {
    throw new HarnessError('environment metadata');
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
    preserveFailureSummary = false,
    afterCommand,
  },
) {
  const summaryPath = summaryName
    ? `${resultDirectory}/${summaryName}`
    : undefined;
  if (summaryPath) await deps.rm(summaryPath, { force: true });
  const runDirectory = resultDirectory.slice('load-tests/results/'.length);
  if (!/^[0-9TZ-]+$/.test(runDirectory))
    throw new HarnessError('k6 control configuration');
  const controlValues = summaryName
    ? {
        ...controls,
        SUMMARY_PATH: `/results/${runDirectory}/${summaryName}`,
      }
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
  if (afterCommand) await afterCommand();
  throwIfAborted(deps.signal);
  if (result.exitCode !== 0 && !preserveFailureSummary)
    throw new HarnessError(phase, result.exitCode);
  return {
    raw,
    summaryPath,
    startedAtMs: result.startedAtMs,
    exitCode: result.exitCode,
  };
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

function boundedSingleTrendMetric(raw, name, phase, maximum) {
  const metric = raw?.metrics?.[name];
  const values = metric?.values;
  if (
    metric?.type !== 'trend' ||
    metric.contains !== 'default' ||
    !values ||
    values.count !== 1
  ) {
    throw new HarnessError(phase);
  }
  const value = values.min;
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > maximum ||
    ['max', 'avg', 'p(95)', 'p(99)'].some((key) => values[key] !== value)
  ) {
    throw new HarnessError(phase);
  }
  return value;
}

function requireSecurityGate(raw) {
  const rejected = boundedCounterMetric(raw, 'security_auth_rejected_total');
  const limited = boundedCounterMetric(raw, 'security_rate_limited_total');
  const unexpected = boundedCounterMetric(raw, 'security_unexpected_total');
  const timeToFirst429Ms = boundedSingleTrendMetric(
    raw,
    'security_time_to_first_429_ms',
    'security gate',
    300_000,
  );
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
  return Object.freeze({
    path: '/admin/session',
    timeToFirst429Ms,
    authRejectedCount: rejected.values.count,
    rateLimitedCount: limited.values.count,
    unexpectedCount: unexpected.values.count,
  });
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

async function checkpointMonitor(monitor) {
  if (!monitor || typeof monitor.checkpoint !== 'function') {
    throw new HarnessError('monitor checkpoint');
  }
  try {
    const checkpoint = monitor.checkpoint();
    if (!checkpoint || typeof checkpoint.then !== 'function') throw new Error();
    await checkpoint;
  } catch {
    throw new HarnessError('monitor checkpoint');
  }
}

function contextFromSamples(samples) {
  let serviceRestarted = false;
  let dependencyErrors = 0;
  const serviceStatuses = Object.fromEntries(
    EXPECTED_SERVICES.map((service) => [service, 'running']),
  );
  const statusSeverity = { running: 0, stopped: 1, missing: 2 };
  for (const sample of samples) {
    for (const service of EXPECTED_SERVICES) {
      const state = sample?.services?.[service];
      if (
        !state ||
        !Object.hasOwn(statusSeverity, state.status) ||
        !Number.isSafeInteger(state.restartCount) ||
        state.restartCount < 0
      ) {
        throw new HarnessError('monitor snapshot');
      }
      if (
        statusSeverity[state.status] > statusSeverity[serviceStatuses[service]]
      ) {
        serviceStatuses[service] = state.status;
      }
      if (state.restartCount > 0) serviceRestarted = true;
    }
    const errors = sample?.dependencyErrors ?? 0;
    if (!Number.isSafeInteger(errors) || errors < 0)
      throw new HarnessError('monitor snapshot');
    dependencyErrors = Math.max(dependencyErrors, errors);
  }
  return { serviceStatuses, serviceRestarted, dependencyErrors };
}

function monitorSamplesSince(monitor, startIndex) {
  return monitorSnapshot(monitor).slice(startIndex);
}

function hasInfrastructureFailure(context) {
  return (
    context.serviceRestarted ||
    context.dependencyErrors > 0 ||
    EXPECTED_SERVICES.some(
      (service) => context.serviceStatuses[service] !== 'running',
    )
  );
}

async function runProbe(deps, monitor, resultDirectory, options, vus, phase) {
  const sampleIndex = monitorSnapshot(monitor).length;
  const fileName = `${phase}-${vus}.json`;
  const { raw, summaryPath, exitCode } = await runK6(deps, resultDirectory, {
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
    preserveFailureSummary: true,
    afterCommand: () => checkpointMonitor(monitor),
  });
  const context = contextFromSamples(monitorSamplesSince(monitor, sampleIndex));
  if (exitCode !== 0 && !hasInfrastructureFailure(context)) {
    throw new HarnessError('capacity probe', exitCode);
  }
  let metrics;
  try {
    metrics = normalizeK6Summary(raw, context);
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
  const { raw, summaryPath, exitCode } = await runK6(deps, resultDirectory, {
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
    preserveFailureSummary: true,
    afterCommand: () => checkpointMonitor(monitor),
  });
  let measurementStartMs;
  let normalized;
  try {
    measurementStartMs = normalizeMeasurementEpoch(raw);
    normalized = normalizeSoakWindows(raw, {
      soakSeconds: options.soakSeconds,
    });
  } catch {
    throw new HarnessError('soak summary parsing');
  }
  const bucketCount = Math.ceil(options.soakSeconds / 60);
  const samples = monitorSamplesSince(monitor, sampleIndex);
  const overallContext = contextFromSamples(samples);
  if (exitCode !== 0 && !hasInfrastructureFailure(overallContext)) {
    throw new HarnessError('soak run', exitCode);
  }
  const monitorBuckets = bucketMonitorSamples(samples, {
    measurementStartMs,
    measurementDurationMs,
    bucketCount,
  });
  const windows = normalized.map(({ minute, metrics }) => {
    const samplesForWindow =
      minute === bucketCount - 1 && samples.length > 0
        ? [...monitorBuckets[minute], samples.at(-1)]
        : monitorBuckets[minute];
    const context = contextFromSamples(samplesForWindow);
    const withContext = {
      ...metrics,
      serviceStatuses: context.serviceStatuses,
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
  const rows = capacity.probes.map(({ phase, vus, metrics, evaluation }) => {
    const endpointCounts = Object.entries(metrics.endpointDurations)
      .map(([endpoint, values]) => `${endpoint}=${values.count}`)
      .join(', ');
    return `| ${phase} | ${vus} | ${metrics.rps} | ${metrics.p95Ms} | ${metrics.p99Ms} | ${metrics.requestFailureRate} | ${metrics.checkFailureRate} | ${endpointCounts} | ${evaluation.passed ? 'PASS' : 'FAIL'} |`;
  });
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
    '| Phase | VUs | RPS | Overall p95 (ms) | Overall p99 (ms) | Request failure | Check failure | Endpoint counts | SLO |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |',
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
  const safeEnvironment = await collectEnvironment(deps, runtime.safe);
  await deps.writeFile(
    `${resultDirectory}/environment.json`,
    json(safeEnvironment),
    { mode: 0o600 },
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
  const securityGate = requireSecurityGate(security.raw);

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
    typeof monitor.checkpoint !== 'function' ||
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
  let monitorSummary;
  try {
    monitorSummary = summarizeMonitorSamples(monitorSnapshot(monitor));
  } catch {
    throw new HarnessError('monitor summary');
  }
  const report = {
    mode: 'capacity',
    environment: safeEnvironment,
    slo: DEFAULT_SLO,
    passed,
    metrics: representativeMetrics,
    trafficMix: TRAFFIC_MIX,
    securityGate,
    monitorSummary,
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
      error instanceof HarnessError ||
      error instanceof CleanupHarnessError ||
      error instanceof CombinedHarnessError
        ? error
        : new HarnessError('workflow');
  } finally {
    const cleanupFailures = [];
    if (state.monitor) {
      try {
        await state.monitor.stop();
      } catch {
        cleanupFailures.push('monitor shutdown failed');
      }
    }
    try {
      await deps?.rm?.(RUNTIME_ENV_PATH, { force: true });
    } catch {
      cleanupFailures.push('runtime cleanup failed');
    }
    try {
      if (typeof deps?.runCommand === 'function') await cleanupCommand(deps);
    } catch (error) {
      cleanupFailures.push(
        error instanceof HarnessError
          ? error.message
          : 'dedicated cleanup failed',
      );
    }
    state.cleanupError =
      cleanupFailures.length > 0
        ? new CleanupHarnessError(cleanupFailures)
        : undefined;
  }
  if (workflowError && state.cleanupError)
    throw new CombinedHarnessError(workflowError, state.cleanupError);
  if (workflowError) throw workflowError;
  if (state.cleanupError) throw state.cleanupError;
  return report;
}

export function safeErrorMessage(error) {
  if (
    error instanceof HarnessError ||
    error instanceof CleanupHarnessError ||
    error instanceof CombinedHarnessError
  ) {
    return error.message;
  }
  if (error instanceof TypeError || error instanceof RangeError)
    return 'configuration failed';
  return 'unexpected load-test harness error';
}
