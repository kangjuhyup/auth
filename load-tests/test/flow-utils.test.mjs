import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertProviderResumePath,
  buildPkce,
  chooseAction,
  createOidcSession,
  extractAuthorizationCode,
  extractInteractionUid,
  oidcTokenProfiles,
  refreshOidcSession,
  resolveAuthorizationCodeWithConsent,
} from '../k6/flow-utils.js';
import { userNameFor } from '../k6/payloads.js';
import { SAFE_SYSTEM_TAGS } from '../k6/system-tags.js';
import {
  createJourneyOptions,
  createSmokeOptions,
  runDeterministicSmoke,
} from '../k6/scenario.js';

const serviceOrigin = 'http://auth-service:3000';

test('buildPkce derives an S256 challenge without retaining the seed', () => {
  const pkce = buildPkce(
    'vu=1;iteration=2;random=abcdefghi',
    (value) => `hash:${value}`,
  );

  assert.deepEqual(pkce, {
    verifier: 'dnU9MTtpdGVyYXRpb249MjtyYW5kb209YWJjZGVmZ2hp',
    challenge: 'hash:dnU9MTtpdGVyYXRpb249MjtyYW5kb209YWJjZGVmZ2hp',
  });
  assert.equal(
    Object.values(pkce).some((value) => value.includes('random=abcdefghi')),
    false,
  );
});

test('buildPkce does not depend on browser-only base64 globals in k6', () => {
  const originalBtoa = globalThis.btoa;
  try {
    globalThis.btoa = undefined;
    assert.deepEqual(
      buildPkce(
        'vu=1;iteration=2;random=abcdefghi',
        (value) => `hash:${value}`,
      ),
      {
        verifier: 'dnU9MTtpdGVyYXRpb249MjtyYW5kb209YWJjZGVmZ2hp',
        challenge: 'hash:dnU9MTtpdGVyYXRpb249MjtyYW5kb209YWJjZGVmZ2hp',
      },
    );
  } finally {
    globalThis.btoa = originalBtoa;
  }
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
    () =>
      extractInteractionUid(
        'http://attacker.test/t/loadtest-acme/interaction/AbC',
        serviceOrigin,
      ),
    /provider origin/,
  );
  assert.throws(
    () =>
      extractInteractionUid(
        `${serviceOrigin}/t/loadtest-acme/interaction/AbC/extra`,
        serviceOrigin,
      ),
    /interaction path/,
  );
});

test('assertProviderResumePath accepts only a same-origin provider resume path', () => {
  assert.equal(
    assertProviderResumePath(
      '/t/loadtest-acme/oidc/auth/AbC?resume=1',
      serviceOrigin,
    ),
    `${serviceOrigin}/t/loadtest-acme/oidc/auth/AbC?resume=1`,
  );
  assert.throws(
    () =>
      assertProviderResumePath('https://attacker.test/resume', serviceOrigin),
    /provider origin/,
  );
  assert.throws(
    () =>
      assertProviderResumePath(
        '/t/loadtest-acme/interaction/AbC',
        serviceOrigin,
      ),
    /provider resume path/,
  );
});

test('extractAuthorizationCode accepts only the exact RP callback and requires a code', () => {
  assert.deepEqual(
    extractAuthorizationCode(
      'http://localhost:18080/callback?code=opaque-code&state=state-1',
    ),
    { code: 'opaque-code', state: 'state-1' },
  );
  assert.throws(
    () =>
      extractAuthorizationCode(
        'http://localhost:18080/callback?error=access_denied',
      ),
    /authorization code/,
  );
  assert.throws(
    () =>
      extractAuthorizationCode('http://localhost:18080/other?code=opaque-code'),
    /redirect URI/,
  );
  assert.throws(
    () =>
      extractAuthorizationCode(
        'http://attacker.test/callback?code=opaque-code',
      ),
    /redirect URI/,
  );
  assert.throws(
    () =>
      extractAuthorizationCode(
        'http://localhost:18080/callback?code=first&code=second&state=state-1',
      ),
    /exactly one authorization code/,
  );
  assert.throws(
    () =>
      extractAuthorizationCode(
        'http://localhost:18080/callback?code=opaque-code&state=first&state=second',
      ),
    /exactly one state/,
  );

  assert.deepEqual(
    refreshOidcSession(
      {
        accessToken: 'resource-access',
        refreshToken: 'resource-refresh',
        userinfoAccessToken: 'userinfo-access',
      },
      {
        accessToken: 'next-resource-access',
        refreshToken: 'next-resource-refresh',
      },
    ),
    {
      accessToken: 'next-resource-access',
      refreshToken: 'next-resource-refresh',
      userinfoAccessToken: 'userinfo-access',
    },
  );
});

test('redirect parsing does not depend on a browser-only URL global in k6', () => {
  const originalUrl = globalThis.URL;
  try {
    globalThis.URL = undefined;
    assert.equal(
      extractInteractionUid(
        '/t/loadtest-acme/interaction/AbC-123_~',
        serviceOrigin,
      ),
      'AbC-123_~',
    );
    assert.equal(
      assertProviderResumePath(
        '/t/loadtest-acme/oidc/auth/AbC?resume=1',
        serviceOrigin,
      ),
      `${serviceOrigin}/t/loadtest-acme/oidc/auth/AbC?resume=1`,
    );
    assert.deepEqual(
      extractAuthorizationCode(
        'http://localhost:18080/callback?code=opaque-code&state=state-1',
      ),
      { code: 'opaque-code', state: 'state-1' },
    );
  } finally {
    globalThis.URL = originalUrl;
  }
});

test('authorization continuation returns a direct callback without consent', () => {
  const failIfCalled = () => {
    throw new Error('consent handler must not run');
  };

  assert.deepEqual(
    resolveAuthorizationCodeWithConsent(
      'http://localhost:18080/callback?code=direct-code&state=direct-state',
      serviceOrigin,
      {
        readConsentDetails: failIfCalled,
        submitConsent: failIfCalled,
        resumeProvider: failIfCalled,
      },
    ),
    { code: 'direct-code', state: 'direct-state' },
  );
});

test('authorization continuation completes exactly one consent interaction', () => {
  assert.deepEqual(
    resolveAuthorizationCodeWithConsent(
      '/t/loadtest-acme/interaction/Consent-1',
      serviceOrigin,
      {
        readConsentDetails: (uid) => ({ uid, prompt: 'consent' }),
        submitConsent: () => ({
          success: true,
          redirectTo: '/t/loadtest-acme/oidc/auth/Resume-1',
        }),
        resumeProvider: () =>
          'http://localhost:18080/callback?code=consented-code&state=consented-state',
      },
    ),
    { code: 'consented-code', state: 'consented-state' },
  );
});

test('authorization continuation fails closed for invalid consent transitions', () => {
  const validHandlers = {
    readConsentDetails: (uid) => ({ uid, prompt: 'consent' }),
    submitConsent: () => ({
      success: true,
      redirectTo: '/t/loadtest-acme/oidc/auth/Resume-1',
    }),
    resumeProvider: () =>
      'http://localhost:18080/callback?code=consented-code&state=consented-state',
  };
  const cases = [
    {
      location: 'http://attacker.test/t/loadtest-acme/interaction/Consent-1',
      handlers: validHandlers,
    },
    {
      location: '/not-an-interaction',
      handlers: validHandlers,
    },
    {
      location: '/t/loadtest-acme/interaction/Consent-1',
      handlers: {
        ...validHandlers,
        readConsentDetails: (uid) => ({ uid, prompt: 'login' }),
      },
    },
    {
      location: '/t/loadtest-acme/interaction/Consent-1',
      handlers: {
        ...validHandlers,
        submitConsent: () => ({ success: true }),
      },
    },
    {
      location: '/t/loadtest-acme/interaction/Consent-1',
      handlers: {
        ...validHandlers,
        resumeProvider: () => '/t/loadtest-acme/interaction/Consent-2',
      },
    },
  ];

  for (const { location, handlers } of cases) {
    assert.throws(
      () =>
        resolveAuthorizationCodeWithConsent(location, serviceOrigin, handlers),
      /^Error: authorization continuation failed$/,
    );
  }
});

test('authorization continuation errors never expose callback or token-like input', () => {
  const sensitive = 'sensitive-code-material';
  assert.throws(
    () =>
      resolveAuthorizationCodeWithConsent(
        `http://localhost:18080/callback?code=${sensitive}`,
        serviceOrigin,
        {
          readConsentDetails: () => ({}),
          submitConsent: () => ({}),
          resumeProvider: () => '',
        },
      ),
    (error) => {
      assert.equal(error.message, 'authorization continuation failed');
      assert.doesNotMatch(error.message, new RegExp(sensitive));
      assert.doesNotMatch(error.message, /localhost|callback|code=/);
      return true;
    },
  );
});

test('OIDC session separates resource and UserInfo token audiences', () => {
  assert.deepEqual(oidcTokenProfiles('https://resource.example.test'), {
    resource: {
      resource: 'https://resource.example.test',
      scope: 'openid profile email offline_access',
      requiresRefreshToken: true,
    },
    userinfo: {
      scope: 'openid profile email',
      requiresRefreshToken: false,
    },
  });

  assert.deepEqual(
    createOidcSession(
      { accessToken: 'resource-access', refreshToken: 'resource-refresh' },
      { accessToken: 'userinfo-access' },
    ),
    {
      accessToken: 'resource-access',
      refreshToken: 'resource-refresh',
      userinfoAccessToken: 'userinfo-access',
    },
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
  assert.throws(
    () => userNameFor(Number.MAX_SAFE_INTEGER + 1),
    /positive safe integer/,
  );
});

test('chooseAction implements the approved cumulative weights', () => {
  assert.equal(chooseAction(0.0), 'introspection');
  assert.equal(chooseAction(0.449999), 'introspection');
  assert.equal(chooseAction(0.45), 'userinfo');
  assert.equal(chooseAction(0.7), 'refresh');
  assert.equal(chooseAction(0.82), 'discovery');
  assert.equal(chooseAction(0.9), 'jwks');
  assert.equal(chooseAction(0.95), 'relogin');
  assert.throws(() => chooseAction(-0.001), /between 0 and 1/);
  assert.throws(() => chooseAction(1), /between 0 and 1/);
});

test('createJourneyOptions uses one constant-VU scenario and preserves host-owned SLO classification', () => {
  assert.deepEqual(
    createJourneyOptions(
      { vus: 7, warmupSeconds: 2, measureSeconds: 3 },
      false,
    ),
    {
      systemTags: ['status', 'method'],
      scenarios: {
        users: {
          executor: 'constant-vus',
          vus: 7,
          duration: '5s',
          gracefulStop: '30s',
        },
      },
      summaryTrendStats: ['count', 'avg', 'max', 'p(95)', 'p(99)'],
      thresholds: {
        load_harness_failure: [{ threshold: 'rate==0', abortOnFail: true }],
      },
    },
  );
});

test('createJourneyOptions cannot expose a deliberately impossible threshold', () => {
  assert.deepEqual(
    createJourneyOptions({ vus: 1, warmupSeconds: 1, measureSeconds: 1 }, true)
      .thresholds,
    { load_harness_failure: [{ threshold: 'rate==0', abortOnFail: true }] },
  );
});

test('createSmokeOptions uses a single deterministic VU and requires every check to pass', () => {
  assert.deepEqual(createSmokeOptions(), {
    systemTags: ['status', 'method'],
    vus: 1,
    iterations: 1,
    thresholds: {
      checks: ['rate==1'],
      load_harness_failure: ['rate==0'],
    },
    summaryTrendStats: ['count', 'avg', 'max', 'p(95)', 'p(99)'],
  });
});

test('runDeterministicSmoke covers every OIDC action in the required protocol order', () => {
  const calls = [];
  const initialSession = {
    accessToken: 'opaque-access',
    refreshToken: 'opaque-refresh',
  };
  const refreshedSession = {
    accessToken: 'next-access',
    refreshToken: 'next-refresh',
  };
  const oidc = {
    login: (userIndex, measuring) => {
      calls.push(['login', userIndex, measuring]);
      return initialSession;
    },
    introspect: (session, measuring) =>
      calls.push(['introspect', session, measuring]),
    userinfo: (session, measuring) =>
      calls.push(['userinfo', session, measuring]),
    refresh: (session, measuring) => {
      calls.push(['refresh', session, measuring]);
      return refreshedSession;
    },
    discovery: (measuring) => calls.push(['discovery', measuring]),
    jwks: (measuring) => calls.push(['jwks', measuring]),
    revokeAndRelogin: (session, userIndex, measuring) => {
      calls.push(['revokeAndRelogin', session, userIndex, measuring]);
    },
  };

  runDeterministicSmoke(oidc);

  assert.deepEqual(calls, [
    ['login', 1, false],
    ['introspect', initialSession, true],
    ['userinfo', initialSession, true],
    ['refresh', initialSession, true],
    ['discovery', true],
    ['jwks', true],
    ['revokeAndRelogin', refreshedSession, 1, true],
  ]);
});
