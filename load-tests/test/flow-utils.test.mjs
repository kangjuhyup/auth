import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertProviderResumePath,
  buildPkce,
  chooseAction,
  extractAuthorizationCode,
  extractInteractionUid,
} from '../k6/flow-utils.js';
import { userNameFor } from '../k6/payloads.js';
import { SAFE_SYSTEM_TAGS } from '../k6/system-tags.js';

const serviceOrigin = 'http://auth-service:3000';

test('buildPkce derives an S256 challenge without retaining the seed', () => {
  const pkce = buildPkce('vu=1;iteration=2;random=abcdefghi', (value) => `hash:${value}`);

  assert.deepEqual(pkce, {
    verifier: 'dnU9MTtpdGVyYXRpb249MjtyYW5kb209YWJjZGVmZ2hp',
    challenge: 'hash:dnU9MTtpdGVyYXRpb249MjtyYW5kb209YWJjZGVmZ2hp',
  });
  assert.equal(Object.values(pkce).some((value) => value.includes('random=abcdefghi')), false);
});

test('extractInteractionUid accepts only a same-origin interaction path', () => {
  assert.equal(
    extractInteractionUid(
      'http://auth-service:3000/t/loadtest-acme/interaction/AbC-123_~',
      serviceOrigin,
    ),
    'AbC-123_~',
  );
  assert.throws(
    () => extractInteractionUid('http://attacker.test/t/loadtest-acme/interaction/AbC', serviceOrigin),
    /provider origin/,
  );
  assert.throws(
    () => extractInteractionUid(`${serviceOrigin}/t/loadtest-acme/interaction/AbC/extra`, serviceOrigin),
    /interaction path/,
  );
});

test('assertProviderResumePath accepts only a same-origin provider resume path', () => {
  assert.equal(
    assertProviderResumePath('/t/loadtest-acme/oidc/auth/AbC?resume=1', serviceOrigin),
    `${serviceOrigin}/t/loadtest-acme/oidc/auth/AbC?resume=1`,
  );
  assert.throws(
    () => assertProviderResumePath('https://attacker.test/resume', serviceOrigin),
    /provider origin/,
  );
  assert.throws(
    () => assertProviderResumePath('/t/loadtest-acme/interaction/AbC', serviceOrigin),
    /provider resume path/,
  );
});

test('extractAuthorizationCode accepts only the exact RP callback and requires a code', () => {
  assert.deepEqual(
    extractAuthorizationCode('http://localhost:18080/callback?code=opaque-code&state=state-1'),
    { code: 'opaque-code', state: 'state-1' },
  );
  assert.throws(
    () => extractAuthorizationCode('http://localhost:18080/callback?error=access_denied'),
    /authorization code/,
  );
  assert.throws(
    () => extractAuthorizationCode('http://localhost:18080/other?code=opaque-code'),
    /redirect URI/,
  );
  assert.throws(
    () => extractAuthorizationCode('http://attacker.test/callback?code=opaque-code'),
    /redirect URI/,
  );
  assert.throws(
    () => extractAuthorizationCode('http://localhost:18080/callback?code=first&code=second&state=state-1'),
    /exactly one authorization code/,
  );
  assert.throws(
    () => extractAuthorizationCode('http://localhost:18080/callback?code=opaque-code&state=first&state=second'),
    /exactly one state/,
  );
});

test('safe k6 system tags keep only fixed status and method dimensions', () => {
  assert.deepEqual(SAFE_SYSTEM_TAGS, ['status', 'method']);
  assert.equal(SAFE_SYSTEM_TAGS.includes('url'), false);
  assert.equal(SAFE_SYSTEM_TAGS.includes('name'), false);
});

test('userNameFor enforces positive safe user-index boundaries', () => {
  assert.equal(userNameFor(1), 'loadtest-user-0001');
  assert.equal(userNameFor(10_000), 'loadtest-user-10000');
  assert.throws(() => userNameFor(0), /positive safe integer/);
  assert.throws(() => userNameFor(Number.MAX_SAFE_INTEGER + 1), /positive safe integer/);
});

test('chooseAction implements the approved cumulative weights', () => {
  assert.equal(chooseAction(0.00), 'introspection');
  assert.equal(chooseAction(0.449999), 'introspection');
  assert.equal(chooseAction(0.45), 'userinfo');
  assert.equal(chooseAction(0.70), 'refresh');
  assert.equal(chooseAction(0.82), 'discovery');
  assert.equal(chooseAction(0.90), 'jwks');
  assert.equal(chooseAction(0.95), 'relogin');
  assert.throws(() => chooseAction(-0.001), /between 0 and 1/);
  assert.throws(() => chooseAction(1), /between 0 and 1/);
});
