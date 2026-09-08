import { SAFE_SYSTEM_TAGS } from './system-tags.js';
import { chooseAction } from './flow-utils.js';

const SUMMARY_TREND_STATS = Object.freeze([
  'count',
  'min',
  'avg',
  'max',
  'p(95)',
  'p(99)',
]);
const MAX_EPOCH_MS = 8_640_000_000_000_000;
const MAX_SOAK_SECONDS = 1_800;

function boundedEpoch(value, name) {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_EPOCH_MS) {
    throw new RangeError(`${name} must be a bounded integer epoch`);
  }
  return value;
}

export function createMeasurementTiming(nowMs, warmupSeconds) {
  const now = boundedEpoch(nowMs, 'current time');
  if (!Number.isSafeInteger(warmupSeconds) || warmupSeconds < 1) {
    throw new RangeError('warmupSeconds must be a positive safe integer');
  }
  const measurementEpochMs = now + warmupSeconds * 1_000;
  boundedEpoch(measurementEpochMs, 'measurement epoch');
  return Object.freeze({ measurementEpochMs });
}

export function measurementMinute(nowMs, measurementEpochMs, soakSeconds) {
  const now = boundedEpoch(nowMs, 'current time');
  const epoch = boundedEpoch(measurementEpochMs, 'measurement epoch');
  if (
    !Number.isSafeInteger(soakSeconds) ||
    soakSeconds < 1 ||
    soakSeconds > MAX_SOAK_SECONDS
  ) {
    throw new RangeError('soakSeconds must be an integer between 1 and 1800');
  }
  if (now < epoch) throw new RangeError('measurement has not started');
  const bucketCount = Math.ceil(soakSeconds / 60);
  return Math.min(bucketCount - 1, Math.floor((now - epoch) / 60_000));
}

export function createJourneyOptions({ vus, warmupSeconds, measureSeconds }) {
  return {
    systemTags: SAFE_SYSTEM_TAGS,
    scenarios: {
      users: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: `${warmupSeconds}s`, target: vus },
          { duration: `${measureSeconds}s`, target: vus },
        ],
        gracefulStop: '30s',
      },
    },
    summaryTrendStats: SUMMARY_TREND_STATS,
    thresholds: {
      load_harness_failure: [{ threshold: 'rate==0', abortOnFail: true }],
    },
  };
}

export function createSmokeOptions() {
  return {
    systemTags: SAFE_SYSTEM_TAGS,
    vus: 1,
    iterations: 1,
    thresholds: {
      checks: ['rate==1'],
      load_harness_failure: ['rate==0'],
    },
    summaryTrendStats: SUMMARY_TREND_STATS,
  };
}

export function runJourneyIteration({
  oidc,
  session,
  userIndex,
  timing,
  now,
  actionValue,
  recordHarnessFailure = () => {},
}) {
  let activeSession = session;
  let initialized = false;
  if (!activeSession) {
    try {
      activeSession = oidc.login(userIndex, false);
      initialized = true;
      recordHarnessFailure(false);
    } catch (error) {
      recordHarnessFailure(true);
      throw error;
    }
  }
  if (typeof now !== 'function') throw new TypeError('clock is required');
  const measuring = now() >= timing.measurementEpochMs;
  return {
    session: oidc.execute(
      chooseAction(actionValue),
      activeSession,
      userIndex,
      measuring,
    ),
    initialized,
    measuring,
  };
}

export function runDeterministicSmoke(oidc) {
  let session = oidc.login(1, false);
  oidc.introspect(session, true);
  oidc.userinfo(session, true);
  session = oidc.refresh(session, true);
  oidc.discovery(true);
  oidc.jwks(true);
  oidc.revokeAndRelogin(session, 1, true);
}
