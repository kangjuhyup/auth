import http from 'k6/http';
import exec from 'k6/execution';
import { Counter } from 'k6/metrics';
import { loadConfig, loadScenarioConfig } from './config.js';
import { handleK6Summary } from './metrics.js';
import { classifyLoginResponse, createRateLimitOptions } from './rate-limit-classifier.js';

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

function rateLimitProbeUsername() {
  return `rate-limit-probe-vu-${exec.vu.idInTest}`;
}

function rateLimitConfig() {
  return config ??= loadConfig(__ENV);
}

function failClosed() {
  unexpected.add(1, RATE_LIMIT_TAGS);
  throw new Error('rate-limit probe received an unexpected response');
}

export default function () {
  const runtimeConfig = rateLimitConfig();
  let response;
  try {
    response = http.post(
      `${runtimeConfig.baseUrl}/admin/session`,
      JSON.stringify({
        username: rateLimitProbeUsername(),
        password: runtimeConfig.loadUserPassword,
      }),
      {
        headers: jsonHeaders,
        tags: RATE_LIMIT_TAGS,
        responseType: 'none',
      },
    );
  } catch {
    failClosed();
  }

  const classification = classifyLoginResponse(response.status);
  if (classification === 'rate-limited') {
    rateLimitObserved = true;
    rateLimited.add(1, RATE_LIMIT_TAGS);
    return;
  }

  if (classification === 'auth-rejected' && !rateLimitObserved) {
    authRejected.add(1, RATE_LIMIT_TAGS);
    return;
  }

  if (response.status >= 200 && response.status < 300 && !rateLimitObserved) {
    return;
  }

  failClosed();
}

export function handleSummary(data) {
  return handleK6Summary(data, scenarioConfig.summaryPath);
}
