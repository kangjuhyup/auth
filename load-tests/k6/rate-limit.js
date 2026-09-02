import http from 'k6/http';
import exec from 'k6/execution';
import { Counter } from 'k6/metrics';
import { loadConfig, loadScenarioConfig } from './config.js';
import { handleK6Summary } from './metrics.js';
import {
  createRateLimitOptions,
  evaluateRateLimitResponse,
  rateLimitProbeUsername,
} from './rate-limit-classifier.js';

const scenarioConfig = loadScenarioConfig(__ENV, 'probe');
const jsonHeaders = Object.freeze({ 'Content-Type': 'application/json' });
const RATE_LIMIT_TAGS = Object.freeze({
  endpoint: 'admin-session-rate-limit',
  profile: 'security-rate-limit',
});

const authRejected = new Counter('security_auth_rejected_total');
const rateLimited = new Counter('security_rate_limited_total');
const unexpected = new Counter('security_unexpected_total');
let rateLimitObserved = false;
let config;

export const options = createRateLimitOptions();

function rateLimitConfig() {
  return config ??= loadConfig(__ENV);
}

function failClosed() {
  throw new Error('rate-limit probe received an unexpected response');
}

export default function () {
  const runtimeConfig = rateLimitConfig();
  let response;
  try {
    response = http.post(
      `${runtimeConfig.baseUrl}/admin/session`,
      JSON.stringify({
        username: rateLimitProbeUsername(
          exec.vu.idInTest,
          exec.scenario.iterationInTest,
        ),
        password: runtimeConfig.loadUserPassword,
      }),
      {
        headers: jsonHeaders,
        tags: RATE_LIMIT_TAGS,
        responseType: 'none',
      },
    );
  } catch {
    unexpected.add(1, RATE_LIMIT_TAGS);
    failClosed();
  }

  const decision = evaluateRateLimitResponse(response.status, rateLimitObserved);
  rateLimitObserved = decision.rateLimitObserved;
  if (decision.metric === 'security_rate_limited_total') {
    rateLimited.add(1, RATE_LIMIT_TAGS);
    return;
  }

  if (decision.metric === 'security_auth_rejected_total') {
    authRejected.add(1, RATE_LIMIT_TAGS);
    return;
  }

  unexpected.add(1, RATE_LIMIT_TAGS);
  failClosed();
}

export function handleSummary(data) {
  return handleK6Summary(data, scenarioConfig.summaryPath);
}
