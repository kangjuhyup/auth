export const DEFAULT_COARSE_LEVELS = Object.freeze([
  10, 25, 50, 100, 200, 400, 800, 1000,
]);

export const DEFAULT_SLO = Object.freeze({
  maxRequestFailureRateExclusive: 0.01,
  maxCheckFailureRate: 0,
  maxP95MsExclusive: 1000,
  maxP99MsExclusive: 2000,
});

const ENDPOINT_NAMES = Object.freeze([
  'login',
  'introspection',
  'userinfo',
  'refresh',
  'discovery',
  'jwks',
  'revoke',
]);

export function buildCoarseLevels(maxVus) {
  if (!Number.isSafeInteger(maxVus) || maxVus < 1) {
    throw new TypeError('maxVus must be a positive safe integer');
  }
  const levels = DEFAULT_COARSE_LEVELS.filter((value) => value <= maxVus);
  if (levels.at(-1) !== maxVus) levels.push(maxVus);
  return [...new Set(levels)].sort((left, right) => left - right);
}

export function nextRefinementLevel(lastPassingVus, firstFailingVus) {
  if (lastPassingVus < 0 || firstFailingVus <= lastPassingVus) {
    throw new RangeError('invalid refinement bracket');
  }
  const gap = firstFailingVus - lastPassingVus;
  if (gap <= 5 || (lastPassingVus > 0 && gap <= lastPassingVus * 0.1)) {
    return null;
  }
  return Math.floor((lastPassingVus + firstFailingVus) / 2);
}

export function evaluateCapacityMetrics(metrics, slo = DEFAULT_SLO) {
  const limits = { ...DEFAULT_SLO, ...slo };
  const violations = [];

  if (metrics.requestFailureRate >= limits.maxRequestFailureRateExclusive) {
    violations.push(
      `request failure rate must be < ${limits.maxRequestFailureRateExclusive}`,
    );
  }
  if (metrics.checkFailureRate > limits.maxCheckFailureRate) {
    violations.push(
      `check failure rate must be <= ${limits.maxCheckFailureRate}`,
    );
  }
  if (metrics.p95Ms >= limits.maxP95MsExclusive) {
    violations.push(`p95 latency must be < ${limits.maxP95MsExclusive} ms`);
  }
  if (metrics.p99Ms >= limits.maxP99MsExclusive) {
    violations.push(`p99 latency must be < ${limits.maxP99MsExclusive} ms`);
  }

  for (const endpoint of ENDPOINT_NAMES) {
    const duration = metrics.endpointDurations?.[endpoint];
    if (!Number.isSafeInteger(duration?.count) || duration.count < 1) {
      violations.push(`endpoint ${endpoint} has no observations`);
      continue;
    }
    if (!Number.isFinite(duration.p95Ms) || duration.p95Ms < 0) {
      violations.push(`endpoint ${endpoint} has invalid p95 latency`);
    } else if (duration.p95Ms >= limits.maxP95MsExclusive) {
      violations.push(
        `endpoint ${endpoint} p95 latency must be < ${limits.maxP95MsExclusive} ms`,
      );
    }
    if (!Number.isFinite(duration.p99Ms) || duration.p99Ms < 0) {
      violations.push(`endpoint ${endpoint} has invalid p99 latency`);
    } else if (duration.p99Ms >= limits.maxP99MsExclusive) {
      violations.push(
        `endpoint ${endpoint} p99 latency must be < ${limits.maxP99MsExclusive} ms`,
      );
    }
  }

  if (metrics.serviceRestarted) violations.push('service restarted');
  if (metrics.dependencyErrors > 0) {
    violations.push(
      `dependency connection errors: ${metrics.dependencyErrors}`,
    );
  }

  return { passed: violations.length === 0, violations };
}
