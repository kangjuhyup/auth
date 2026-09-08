import { Rate } from 'k6/metrics';
import { loadConfig, loadScenarioConfig } from './config.js';
import { handleK6Summary } from './metrics.js';
import { createOidcClient } from './oidc.js';
import { createSmokeOptions, runDeterministicSmoke } from './scenario.js';
import { loadTlsOptions } from './tls.js';

const scenarioConfig = loadScenarioConfig(__ENV, 'smoke');
const harnessFailure = new Rate('load_harness_failure');

export const options = {
  ...createSmokeOptions(),
  ...loadTlsOptions(__ENV),
};

export default function () {
  try {
    runDeterministicSmoke(
      createOidcClient({
        ...loadConfig(__ENV),
        runKind: scenarioConfig.runKind,
      }),
    );
    harnessFailure.add(false);
  } catch (error) {
    harnessFailure.add(true);
    throw error;
  }
}

export function handleSummary(data) {
  return handleK6Summary(data, scenarioConfig.summaryPath);
}
