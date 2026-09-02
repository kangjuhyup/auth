import { sleep } from 'k6';
import exec from 'k6/execution';
import { Rate } from 'k6/metrics';
import { loadConfig, loadScenarioConfig } from './config.js';
import { chooseAction } from './flow-utils.js';
import {
  handleK6Summary,
  recordMeasurementEpoch,
  soakSubmetricThresholds,
} from './metrics.js';
import { createOidcClient } from './oidc.js';
import {
  createJourneyOptions,
  createMeasurementTiming,
  measurementMinute,
} from './scenario.js';

const scenarioConfig = loadScenarioConfig(__ENV, 'probe');
const harnessFailure = new Rate('load_harness_failure');
let oidc;
let session;

const journeyOptions = createJourneyOptions(scenarioConfig);

export const options = {
  ...journeyOptions,
  thresholds: {
    ...journeyOptions.thresholds,
    ...soakSubmetricThresholds,
  },
};

function oidcClient(timing) {
  return (oidc ??= createOidcClient({
    ...loadConfig(__ENV),
    runKind: scenarioConfig.runKind,
    ...(scenarioConfig.runKind === 'soak'
      ? {
          measurementMinute: () =>
            measurementMinute(
              Date.now(),
              timing.measurementEpochMs,
              scenarioConfig.soakSeconds,
            ),
        }
      : {}),
  }));
}

export function setup() {
  const timing = createMeasurementTiming(
    Date.now(),
    scenarioConfig.warmupSeconds,
  );
  recordMeasurementEpoch(timing.measurementEpochMs);
  return timing;
}

export default function (timing) {
  const userIndex = exec.vu.idInTest;
  if (!session) {
    try {
      session = oidcClient(timing).login(userIndex, false);
      harnessFailure.add(false);
    } catch (error) {
      harnessFailure.add(true);
      throw error;
    }
  }
  const measuring = Date.now() >= timing.measurementEpochMs;
  session = oidcClient(timing).execute(
    chooseAction(Math.random()),
    session,
    userIndex,
    measuring,
  );
  sleep(1 + Math.random() * 2);
}

export function handleSummary(data) {
  return handleK6Summary(data, scenarioConfig.summaryPath);
}
