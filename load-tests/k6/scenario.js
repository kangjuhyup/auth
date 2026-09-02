import { SAFE_SYSTEM_TAGS } from './system-tags.js';

const SUMMARY_TREND_STATS = Object.freeze([
  'count',
  'avg',
  'max',
  'p(95)',
  'p(99)',
]);

export function createJourneyOptions({ vus, warmupSeconds, measureSeconds }) {
  return {
    systemTags: SAFE_SYSTEM_TAGS,
    scenarios: {
      users: {
        executor: 'constant-vus',
        vus,
        duration: `${warmupSeconds + measureSeconds}s`,
        gracefulStop: '30s',
      },
    },
    summaryTrendStats: SUMMARY_TREND_STATS,
    thresholds: {
      load_harness_failure: [{ threshold: 'rate==0', abortOnFail: true }],
    },
  };
}

export function createSmokeOptions() {
  return {
    systemTags: SAFE_SYSTEM_TAGS,
    vus: 1,
    iterations: 1,
    thresholds: {
      checks: ['rate==1'],
      load_harness_failure: ['rate==0'],
    },
    summaryTrendStats: SUMMARY_TREND_STATS,
  };
}

export function runDeterministicSmoke(oidc) {
  let session = oidc.login(1, false);
  oidc.introspect(session, true);
  oidc.userinfo(session, true);
  session = oidc.refresh(session, true);
  oidc.discovery(true);
  oidc.jwks(true);
  oidc.revokeAndRelogin(session, 1, true);
}
