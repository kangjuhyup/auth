import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCoarseLevels,
  evaluateCapacityMetrics,
  nextRefinementLevel,
} from '../lib/capacity.mjs';

const completeEndpoints = Object.fromEntries(
  ['login', 'introspection', 'userinfo', 'refresh', 'discovery', 'jwks', 'revoke']
    .map((name) => [name, { count: 1, p95Ms: 100, p99Ms: 200 }]),
);

function passingMetrics(overrides = {}) {
  return {
    requestFailureRate: 0,
    checkFailureRate: 0,
    p95Ms: 999,
    p99Ms: 1999,
    endpointDurations: completeEndpoints,
    serviceRestarted: false,
    dependencyErrors: 0,
    ...overrides,
  };
}

test('buildCoarseLevels appends a non-standard max without exceeding it', () => {
  assert.deepEqual(buildCoarseLevels(750), [10, 25, 50, 100, 200, 400, 750]);
});

test('buildCoarseLevels truncates defaults at max and supports low caps', () => {
  assert.deepEqual(buildCoarseLevels(400), [10, 25, 50, 100, 200, 400]);
  assert.deepEqual(buildCoarseLevels(7), [7]);
});

test('buildCoarseLevels rejects invalid caps', () => {
  assert.throws(() => buildCoarseLevels(0), /positive safe integer/);
  assert.throws(() => buildCoarseLevels(1.5), /positive safe integer/);
});

test('nextRefinementLevel stops at a five-VU gap', () => {
  assert.equal(nextRefinementLevel(45, 50), null);
});

test('nextRefinementLevel stops when the gap is at most ten percent', () => {
  assert.equal(nextRefinementLevel(100, 110), null);
});

test('nextRefinementLevel returns a floored untested midpoint', () => {
  assert.equal(nextRefinementLevel(100, 201), 150);
});

test('nextRefinementLevel rejects an invalid bracket', () => {
  assert.throws(() => nextRefinementLevel(20, 20), /invalid refinement bracket/);
  assert.throws(() => nextRefinementLevel(-1, 20), /invalid refinement bracket/);
});

test('evaluateCapacityMetrics accepts metrics strictly inside every default SLO', () => {
  assert.deepEqual(evaluateCapacityMetrics(passingMetrics()), { passed: true, violations: [] });
});

test('evaluateCapacityMetrics rejects the strict one-percent boundary', () => {
  const result = evaluateCapacityMetrics(passingMetrics({ requestFailureRate: 0.01 }));
  assert.equal(result.passed, false);
  assert.match(result.violations.join('\n'), /request failure rate/);
});

test('evaluateCapacityMetrics rejects check failures and exclusive latency boundaries', () => {
  const result = evaluateCapacityMetrics(passingMetrics({
    checkFailureRate: 0.0001,
    p95Ms: 1000,
    p99Ms: 2000,
  }));
  assert.equal(result.passed, false);
  assert.deepEqual(result.violations, [
    'check failure rate must be <= 0',
    'p95 latency must be < 1000 ms',
    'p99 latency must be < 2000 ms',
  ]);
});

test('evaluateCapacityMetrics rejects missing or empty metrics for every named endpoint', () => {
  const endpointDurations = { ...completeEndpoints };
  delete endpointDurations.jwks;
  endpointDurations.login = { count: 0, p95Ms: 100, p99Ms: 200 };
  const result = evaluateCapacityMetrics(passingMetrics({ endpointDurations }));
  assert.equal(result.passed, false);
  assert.deepEqual(result.violations, [
    'endpoint login has no observations',
    'endpoint jwks has no observations',
  ]);
});

test('evaluateCapacityMetrics rejects an endpoint without a positive count', () => {
  const endpointDurations = { ...completeEndpoints, login: { p95Ms: 100, p99Ms: 200 } };
  const result = evaluateCapacityMetrics(passingMetrics({ endpointDurations }));
  assert.deepEqual(result.violations, ['endpoint login has no observations']);
});

test('evaluateCapacityMetrics reports restart and dependency errors last in stable order', () => {
  const result = evaluateCapacityMetrics(passingMetrics({
    serviceRestarted: true,
    dependencyErrors: 2,
  }));
  assert.deepEqual(result.violations, [
    'service restarted',
    'dependency connection errors: 2',
  ]);
});

test('evaluateCapacityMetrics accepts custom SLO values', () => {
  const result = evaluateCapacityMetrics(passingMetrics({
    requestFailureRate: 0.02,
    p95Ms: 1200,
    p99Ms: 2200,
  }), {
    maxRequestFailureRateExclusive: 0.03,
    maxCheckFailureRate: 0,
    maxP95MsExclusive: 1300,
    maxP99MsExclusive: 2300,
  });
  assert.equal(result.passed, true);
});
