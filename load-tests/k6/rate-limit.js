import http from 'k6/http';
import exec from 'k6/execution';
import { Counter, Trend } from 'k6/metrics';
import { loadConfig, loadScenarioConfig } from './config.js';
import { handleK6Summary } from './metrics.js';
import {
  createRateLimitOptions,
  evaluateRateLimitResponse,
  rateLimitProbeUsername,
  timeToFirstRateLimit,
} from './rate-limit-classifier.js';
import { loadTlsOptions } from './tls.js';

const scenarioConfig = loadScenarioConfig(__ENV, 'probe');
const jsonHeaders = Object.freeze({ 'Content-Type': 'application/json' });
const RATE_LIMIT_TAGS = Object.freeze({
  endpoint: 'admin-session-rate-limit',
  profile: 'security-rate-limit',
});

const authRejected = new Counter('security_auth_rejected_total');
const rateLimited = new Counter('security_rate_limited_total');
const unexpected = new Counter('security_unexpected_total');
const firstRateLimitDuration = new Trend('security_time_to_first_429_ms');
let rateLimitObserved = false;
let config;

export const options = {
  ...createRateLimitOptions(),
  ...loadTlsOptions(__ENV),
};

export function setup() {
  return { startedAtMs: Date.now() };
}

function rateLimitConfig() {
  return (config ??= loadConfig(__ENV));
}

function failClosed() {
  throw new Error('rate-limit probe received an unexpected response');
}

export default function (timing) {
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

  const decision = evaluateRateLimitResponse(
    response.status,
    rateLimitObserved,
  );
  if (
    decision.classification === 'rate-limited' &&
    rateLimitObserved === false
  ) {
    firstRateLimitDuration.add(
      timeToFirstRateLimit(timing.startedAtMs, Date.now()),
      RATE_LIMIT_TAGS,
    );
  }
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
