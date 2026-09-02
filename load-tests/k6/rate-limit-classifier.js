import { SAFE_SYSTEM_TAGS } from './system-tags.js';

export function classifyLoginResponse(status) {
  if (status === 401) return 'auth-rejected';
  if (status === 429) return 'rate-limited';
  return 'unexpected';
}

function positiveSafeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
  return value;
}

function nonNegativeSafeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
  return value;
}

export function rateLimitProbeUsername(vuId, iteration) {
  const safeVuId = positiveSafeInteger(vuId, 'vuId');
  const safeIteration = nonNegativeSafeInteger(iteration, 'iteration');
  return `rate-limit-probe-v${safeVuId}-i${safeIteration}`;
}

export function evaluateRateLimitResponse(status, rateLimitObserved) {
  const classification = classifyLoginResponse(status);
  if (classification === 'rate-limited') {
    return {
      classification,
      metric: 'security_rate_limited_total',
      accepted: true,
      rateLimitObserved: true,
    };
  }

  if (classification === 'auth-rejected' && !rateLimitObserved) {
    return {
      classification,
      metric: 'security_auth_rejected_total',
      accepted: true,
      rateLimitObserved: false,
    };
  }

  return {
    classification,
    metric: 'security_unexpected_total',
    accepted: false,
    rateLimitObserved: Boolean(rateLimitObserved),
  };
}

export function timeToFirstRateLimit(startedAtMs, observedAtMs) {
  if (
    !Number.isSafeInteger(startedAtMs) ||
    startedAtMs < 1 ||
    !Number.isSafeInteger(observedAtMs) ||
    observedAtMs < startedAtMs ||
    observedAtMs - startedAtMs > 300_000
  ) {
    throw new RangeError('time to first 429 must be between 0 and 300000 ms');
  }
  return observedAtMs - startedAtMs;
}

export function createRateLimitOptions() {
  return {
    systemTags: [...SAFE_SYSTEM_TAGS],
    vus: 1,
    iterations: 15,
    thresholds: {
      security_rate_limited_total: ['count>0'],
      security_unexpected_total: ['count==0'],
    },
    summaryTrendStats: ['count', 'min', 'avg', 'max', 'p(95)', 'p(99)'],
  };
}
