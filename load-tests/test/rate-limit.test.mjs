import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyLoginResponse,
  createRateLimitOptions,
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
