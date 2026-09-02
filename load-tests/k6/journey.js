import { sleep } from 'k6';
import exec from 'k6/execution';
import { Rate } from 'k6/metrics';
import { loadConfig, loadScenarioConfig } from './config.js';
import { chooseAction } from './flow-utils.js';
import { handleK6Summary, soakSubmetricThresholds } from './metrics.js';
import { createOidcClient } from './oidc.js';
import { createJourneyOptions } from './scenario.js';

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

function oidcClient() {
  return (oidc ??= createOidcClient({
    ...loadConfig(__ENV),
    runKind: scenarioConfig.runKind,
  }));
}

export function setup() {
  return { measureAfterMs: Date.now() + scenarioConfig.warmupSeconds * 1000 };
}

export default function (timing) {
  const userIndex = exec.vu.idInTest;
  if (!session) {
    try {
      session = oidcClient().login(userIndex, false);
      harnessFailure.add(false);
    } catch (error) {
      harnessFailure.add(true);
      throw error;
    }
  }
  const measuring = Date.now() >= timing.measureAfterMs;
  session = oidcClient().execute(
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
