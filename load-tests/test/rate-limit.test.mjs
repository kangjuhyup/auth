import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyLoginResponse,
  createRateLimitOptions,
  evaluateRateLimitResponse,
  rateLimitProbeUsername,
} from '../k6/rate-limit-classifier.js';

test('classifies only intended authentication rejection and throttling statuses', () => {
  assert.equal(classifyLoginResponse(200), 'unexpected');
  assert.equal(classifyLoginResponse(401), 'auth-rejected');
  assert.equal(classifyLoginResponse(403), 'unexpected');
  assert.equal(classifyLoginResponse(302), 'unexpected');
  assert.equal(classifyLoginResponse(429), 'rate-limited');
  assert.equal(classifyLoginResponse(500), 'unexpected');
  assert.equal(classifyLoginResponse(0), 'unexpected');
  assert.equal(classifyLoginResponse(undefined), 'unexpected');
});

test('creates a fixed one-VU rate-limit profile without URL or name system tags', () => {
  assert.deepEqual(createRateLimitOptions(), {
    systemTags: ['status', 'method'],
    vus: 1,
    iterations: 15,
    thresholds: {
      security_rate_limited_total: ['count>0'],
      security_unexpected_total: ['count==0'],
    },
  });
});

test('creates a bounded unique non-provisioned username for each VU iteration', () => {
  const probeUsernames = new Set();
  for (const vuId of [1, 2]) {
    for (let iteration = 0; iteration < 15; iteration += 1) {
      probeUsernames.add(rateLimitProbeUsername(vuId, iteration));
    }
  }

  assert.equal(probeUsernames.size, 30);
  assert.equal(rateLimitProbeUsername(1, 0), 'rate-limit-probe-v1-i0');
  assert.equal(rateLimitProbeUsername(2, 14), 'rate-limit-probe-v2-i14');
  assert.throws(() => rateLimitProbeUsername(0, 0), /vuId/);
  assert.throws(() => rateLimitProbeUsername(1, -1), /iteration/);
  assert.throws(() => rateLimitProbeUsername(1.5, 0), /vuId/);
});

test('marks every successful admin-session response as an unexpected failing metric', () => {
  for (const status of [200, 201, 204]) {
    assert.deepEqual(evaluateRateLimitResponse(status, false), {
      classification: 'unexpected',
      metric: 'security_unexpected_total',
      accepted: false,
      rateLimitObserved: false,
    });
  }

  assert.deepEqual(evaluateRateLimitResponse(401, false), {
    classification: 'auth-rejected',
    metric: 'security_auth_rejected_total',
    accepted: true,
    rateLimitObserved: false,
  });
  assert.deepEqual(evaluateRateLimitResponse(403, false), {
    classification: 'unexpected',
    metric: 'security_unexpected_total',
    accepted: false,
    rateLimitObserved: false,
  });
  assert.deepEqual(evaluateRateLimitResponse(429, false), {
    classification: 'rate-limited',
    metric: 'security_rate_limited_total',
    accepted: true,
    rateLimitObserved: true,
  });
});

test('fails closed for locks, redirects, server responses, and transport-like statuses', () => {
  for (const status of [423, 302, 500, 0, undefined]) {
    assert.deepEqual(evaluateRateLimitResponse(status, false), {
      classification: 'unexpected',
      metric: 'security_unexpected_total',
      accepted: false,
      rateLimitObserved: false,
    });
  }
});
