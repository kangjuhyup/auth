# k6 Local Capacity Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reproducible k6 harness that finds the maximum SLO-compliant concurrent user count for one local Docker `auth-service` instance and verifies that count for 30 minutes.

**Architecture:** A dedicated Docker Compose project runs one production-built service with isolated PostgreSQL and Redis containers, while the official k6 container drives the existing node-oidc-provider endpoints. Small pure JavaScript modules own capacity search, safe configuration, result evaluation, and report rendering; k6 modules own provisioning and protocol-correct user journeys; a Node.js orchestrator owns lifecycle, monitoring, coarse/refined capacity runs, soak execution, and cleanup.

**Tech Stack:** Node.js 24 ESM and `node:test`, Docker Compose v2, `grafana/k6:2.2.0`, existing NestJS/node-oidc-provider service, PostgreSQL 16, Redis 7.

**Spec:** `docs/superpowers/specs/2026-09-02-k6-local-capacity-test-design.md`

## Global Constraints

- Treat `ui/` and `service/` as separate applications; do not add runtime coupling.
- Do not change `service/src/domain`, `service/src/application`, `service/src/infrastructure`, `service/src/presentation`, or node-oidc-provider protocol behavior.
- Use the existing `deploy/docker/Dockerfile.service` and service entrypoint so migrations and the production build path are exercised.
- The measured service topology is exactly one `auth-service` container plus dedicated PostgreSQL and Redis containers.
- OIDC Authorization Code, token issuance, PKCE S256, redirect validation, sessions, interactions, refresh rotation, introspection, and revocation stay delegated to node-oidc-provider.
- Every VU uses a unique user, cookie jar, state, nonce, and PKCE verifier.
- Never log or persist passwords, client secrets, tokens, authorization codes, PKCE verifiers, cookie values, or raw key material.
- The capacity SLO is request failure rate `< 1%`, p95 `< 1000 ms`, p99 `< 2000 ms`, zero normal-flow check failures, zero service restarts, and zero PostgreSQL/Redis connection errors.
- The default coarse VU levels are `10, 25, 50, 100, 200, 400, 800, 1000`; each capacity probe has a 1-minute warm-up and 3-minute measurement window.
- Refinement stops when the pass/fail gap is at most 5 VUs or at most 10% of the passing VU count.
- The final soak duration is 30 minutes.
- Default capacity-profile limits are `HTTP_THROTTLE_LIMIT=1000000` and `LOGIN_RATE_LIMIT_IP_MAX=100000`; do not disable the guards.
- Only the dedicated Compose project `auth-load` may be cleaned up. Existing local containers and volumes are out of scope.
- Full capacity and soak runs are operator-invoked, never part of CI; CI-suitable verification stops at unit/config/static checks and a manually selected 1-VU smoke run.

---

## File Map

### Create

- `docker-compose.load.yml` — isolated service, PostgreSQL, Redis, and k6 definitions.
- `load-tests/package.json` — ESM boundary for Node tests without adding a Yarn workspace.
- `load-tests/.env.load.example` — non-secret operator tunables and documented defaults.
- `load-tests/lib/capacity.mjs` — coarse/refined VU calculation and SLO evaluation.
- `load-tests/lib/config.mjs` — host-side option parsing, local-target guard, and secret generation.
- `load-tests/lib/report.mjs` — k6 summary normalization, environment allowlisting, and Markdown report rendering.
- `load-tests/lib/monitor.mjs` — Docker/PostgreSQL/Redis sample collection.
- `load-tests/lib/orchestrator.mjs` — dependency-injected workflow for Compose and k6 runs.
- `load-tests/run-capacity.mjs` — executable Node entrypoint and signal handling.
- `load-tests/k6/config.js` — k6 environment parsing and target validation.
- `load-tests/k6/payloads.js` — deterministic tenant, client, and user provisioning payloads.
- `load-tests/k6/provision.js` — admin bootstrap calls and parallel user signup.
- `load-tests/k6/flow-utils.js` — redirect parsing, user indexing, and weighted-action selection.
- `load-tests/k6/metrics.js` — measurement-window custom metrics and summary output.
- `load-tests/k6/oidc.js` — provider-owned Authorization Code + PKCE and token operations.
- `load-tests/k6/journey.js` — constant-VU real-usage scenario.
- `load-tests/k6/smoke.js` — deterministic one-VU traversal of every OIDC action.
- `load-tests/k6/rate-limit-classifier.js` — pure status classification for the security profile.
- `load-tests/k6/rate-limit.js` — security-profile rate-limit verification.
- `load-tests/test/capacity.test.mjs` — search and SLO unit tests.
- `load-tests/test/config.test.mjs` — local-target and runtime-secret tests.
- `load-tests/test/report.test.mjs` — summary parsing, redaction, and Markdown tests.
- `load-tests/test/compose.test.mjs` — rendered Compose topology test.
- `load-tests/test/payloads.test.mjs` — provisioning payload tests.
- `load-tests/test/flow-utils.test.mjs` — redirect and weighted action tests.
- `load-tests/test/monitor.test.mjs` — resource-sample parser tests.
- `load-tests/test/orchestrator.test.mjs` — workflow ordering and cleanup tests.
- `load-tests/test/rate-limit.test.mjs` — expected authentication and throttling status tests.
- `load-tests/README.md` — setup, commands, duration, safety, and interpretation guide.

### Modify

- `.gitignore` — exclude `load-tests/.runtime.env` and `load-tests/results/`.
- `package.json` — add load-test unit, config, smoke, capacity, and cleanup scripts.

---

### Task 1: Capacity Search and SLO Engine

**Files:**
- Create: `load-tests/package.json`
- Create: `load-tests/lib/capacity.mjs`
- Create: `load-tests/test/capacity.test.mjs`

**Interfaces:**
- Produces: `buildCoarseLevels(maxVus: number): number[]`
- Produces: `nextRefinementLevel(lastPassingVus: number, firstFailingVus: number): number | null`
- Produces: `evaluateCapacityMetrics(metrics: CapacityMetrics, slo?: Slo): CapacityEvaluation`
- `CapacityEvaluation` shape: `{ passed: boolean, violations: string[] }`

- [ ] **Step 1: Establish the ESM test boundary**

Create `load-tests/package.json`:

```json
{
  "name": "@auth/load-tests",
  "private": true,
  "type": "module"
}
```

- [ ] **Step 2: Write failing capacity tests**

Create `load-tests/test/capacity.test.mjs` with tests covering default truncation, custom caps between coarse levels, low caps, midpoint rounding, both refinement stop conditions, every SLO boundary, missing endpoint metrics, service restarts, and dependency errors. Core assertions:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCoarseLevels,
  evaluateCapacityMetrics,
  nextRefinementLevel,
} from '../lib/capacity.mjs';

test('buildCoarseLevels appends a non-standard max without exceeding it', () => {
  assert.deepEqual(buildCoarseLevels(750), [10, 25, 50, 100, 200, 400, 750]);
});

test('nextRefinementLevel stops at a five-VU gap', () => {
  assert.equal(nextRefinementLevel(45, 50), null);
});

test('nextRefinementLevel returns an untested midpoint', () => {
  assert.equal(nextRefinementLevel(100, 200), 150);
});

test('evaluateCapacityMetrics rejects the strict one-percent boundary', () => {
  const result = evaluateCapacityMetrics({
    requestFailureRate: 0.01,
    checkFailureRate: 0,
    p95Ms: 500,
    p99Ms: 900,
    endpointDurations: {
      login: { count: 1, p95Ms: 500, p99Ms: 900 },
      introspection: { count: 1, p95Ms: 100, p99Ms: 200 },
      userinfo: { count: 1, p95Ms: 100, p99Ms: 200 },
      refresh: { count: 1, p95Ms: 100, p99Ms: 200 },
      discovery: { count: 1, p95Ms: 100, p99Ms: 200 },
      jwks: { count: 1, p95Ms: 100, p99Ms: 200 },
      revoke: { count: 1, p95Ms: 100, p99Ms: 200 }
    },
    serviceRestarted: false,
    dependencyErrors: 0
  });
  assert.equal(result.passed, false);
  assert.match(result.violations.join('\n'), /request failure rate/);
});
```

- [ ] **Step 3: Run tests and confirm the module is missing**

Run: `node --test load-tests/test/capacity.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `load-tests/lib/capacity.mjs`.

- [ ] **Step 4: Implement the minimal capacity engine**

Create `load-tests/lib/capacity.mjs` with these constants and exact comparison semantics:

```js
export const DEFAULT_COARSE_LEVELS = Object.freeze([
  10, 25, 50, 100, 200, 400, 800, 1000,
]);

export const DEFAULT_SLO = Object.freeze({
  maxRequestFailureRateExclusive: 0.01,
  maxCheckFailureRate: 0,
  maxP95MsExclusive: 1000,
  maxP99MsExclusive: 2000,
});

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
```

Implement `evaluateCapacityMetrics` so equality fails for the exclusive failure-rate and latency limits, any nonzero check failure fails, every named endpoint must have `count > 0`, and infrastructure violations are appended in deterministic order.

- [ ] **Step 5: Run the capacity tests**

Run: `node --test load-tests/test/capacity.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add load-tests/package.json load-tests/lib/capacity.mjs load-tests/test/capacity.test.mjs
git commit -m "test(load): add capacity search and SLO engine"
```

---

### Task 2: Safe Configuration and Result Reporting

**Files:**
- Create: `load-tests/lib/config.mjs`
- Create: `load-tests/lib/report.mjs`
- Create: `load-tests/test/config.test.mjs`
- Create: `load-tests/test/report.test.mjs`

**Interfaces:**
- Produces: `parseOptions(env: NodeJS.ProcessEnv): LoadOptions`
- Produces: `assertLocalTarget(url: string, allowRemote?: boolean): URL`
- Produces: `createRuntimeEnvironment(options, randomBytesFn): { text: string, safe: object }`
- Produces: `normalizeK6Summary(raw, context): CapacityMetrics`
- Produces: `normalizeSoakWindows(raw): Array<{ minute: number, metrics: CapacityMetrics }>`
- Produces: `sanitizeEnvironment(input): SafeEnvironment`
- Produces: `renderSummaryMarkdown(report): string`
- Consumes: `evaluateCapacityMetrics` output from Task 1.

- [ ] **Step 1: Write failing configuration tests**

Cover accepted hosts (`auth-service`, `localhost`, `127.0.0.1`, `[::1]`), rejected remote URLs, explicit remote override, integer/duration parsing, and generated runtime text. The test must prove runtime text contains generated values while `safe` contains none of them:

```js
test('createRuntimeEnvironment never returns secrets in safe metadata', () => {
  const generated = createRuntimeEnvironment(
    parseOptions({ MAX_VUS: '50' }),
    () => Buffer.alloc(32, 7),
  );
  assert.match(generated.text, /ADMIN_PASSWORD=/);
  assert.doesNotMatch(JSON.stringify(generated.safe), /07070707/);
  assert.deepEqual(generated.safe, {
    maxVus: 50,
    warmupSeconds: 60,
    measureSeconds: 180,
    soakSeconds: 1800,
    mode: 'capacity',
  });
});
```

- [ ] **Step 2: Write failing report tests**

Build a fixture in the k6 v2 machine-readable summary shape and assert `normalizeK6Summary` reads `p(95)`, `p(99)`, `rate`, and `count` for the custom metrics. Assert `sanitizeEnvironment` uses an allowlist and removes keys such as `ADMIN_PASSWORD`, `SERVICE_CLIENT_SECRET`, `access_token`, arbitrary unknown keys, and nested authorization headers. Assert Markdown contains the pass/fail bracket, soak duration, SLO table, endpoint table, and no fixture secret.

- [ ] **Step 3: Run tests and confirm both modules are missing**

Run: `node --test load-tests/test/config.test.mjs load-tests/test/report.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 4: Implement strict option parsing and local-target protection**

In `load-tests/lib/config.mjs`, define defaults exactly:

```js
const LOCAL_HOSTS = new Set(['auth-service', 'localhost', '127.0.0.1', '[::1]']);

export function assertLocalTarget(rawUrl, allowRemote = false) {
  const url = new URL(rawUrl);
  if (!allowRemote && !LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`Refusing non-local load-test target: ${url.hostname}`);
  }
  return url;
}

export function parseOptions(env) {
  return Object.freeze({
    maxVus: positiveInteger(env.MAX_VUS ?? '1000', 'MAX_VUS'),
    warmupSeconds: positiveInteger(env.WARMUP_SECONDS ?? '60', 'WARMUP_SECONDS'),
    measureSeconds: positiveInteger(env.MEASURE_SECONDS ?? '180', 'MEASURE_SECONDS'),
    soakSeconds: positiveInteger(env.SOAK_SECONDS ?? '1800', 'SOAK_SECONDS'),
    mode: enumValue(env.LOAD_TEST_MODE ?? 'capacity', ['capacity', 'smoke']),
    allowRemoteTarget: env.ALLOW_REMOTE_TARGET === 'true',
  });
}
```

Generate 32-byte random hex values for `ADMIN_PASSWORD`, `DB_PASSWORD`, `LOAD_USER_PASSWORD`, `JWKS_ENCRYPTION_KEY`, and `OTP_TOKEN_SECRET`, two independent cookie keys, and a 48-byte service client secret. Return secret-bearing dotenv text separately from an allowlisted `safe` object.

- [ ] **Step 5: Implement summary normalization and allowlisted reports**

In `load-tests/lib/report.mjs`, normalize only these custom metric names:

```js
export const ENDPOINT_METRICS = Object.freeze({
  login: 'load_login_duration_ms',
  introspection: 'load_introspection_duration_ms',
  userinfo: 'load_userinfo_duration_ms',
  refresh: 'load_refresh_duration_ms',
  discovery: 'load_discovery_duration_ms',
  jwks: 'load_jwks_duration_ms',
  revoke: 'load_revoke_duration_ms',
});
```

Read only `load_request_failed`, `load_check_failed`, `load_http_req_duration_ms`, and `ENDPOINT_METRICS`. Missing metrics normalize to a zero count so Task 1 rejects the probe. `sanitizeEnvironment` must construct a new object from the documented allowlist rather than recursively deleting suspicious names.

For soak summaries, also read only bounded submetrics with tags `minute:0` through `minute:29`. `normalizeSoakWindows` rejects out-of-range or non-integer minute tags and returns exactly 30 ordered buckets when `SOAK_SECONDS=1800`, using zero-count metrics for absent buckets so evaluation fails closed.

- [ ] **Step 6: Run configuration and report tests**

Run: `node --test load-tests/test/config.test.mjs load-tests/test/report.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add load-tests/lib/config.mjs load-tests/lib/report.mjs load-tests/test/config.test.mjs load-tests/test/report.test.mjs
git commit -m "test(load): add safe configuration and reports"
```

---

### Task 3: Isolated Docker Compose Topology

**Files:**
- Create: `docker-compose.load.yml`
- Create: `load-tests/.env.load.example`
- Create: `load-tests/test/compose.test.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Provides Compose services named exactly `postgres-load`, `redis-load`, `auth-service`, and `k6`.
- Provides host health endpoint `http://127.0.0.1:13000/health`.
- Mounts `./load-tests/k6` read-only at `/scripts` and `./load-tests/results` at `/results` in k6.
- Consumes generated `load-tests/.runtime.env` through `docker compose --env-file`.

- [ ] **Step 1: Write the failing Compose topology test**

Create `load-tests/test/compose.test.mjs`. Run `docker compose -f docker-compose.load.yml --env-file load-tests/.env.load.example config --format json`, parse stdout, and assert:

```js
assert.deepEqual(Object.keys(config.services).sort(), [
  'auth-service', 'k6', 'postgres-load', 'redis-load',
]);
assert.equal(config.services['auth-service'].deploy?.replicas ?? 1, 1);
assert.deepEqual(config.services['auth-service'].depends_on['postgres-load'].condition, 'service_healthy');
assert.deepEqual(config.services['auth-service'].depends_on['redis-load'].condition, 'service_healthy');
assert.equal(config.services.k6.image, 'grafana/k6:2.2.0');
assert.match(JSON.stringify(config.services), /auth-load/);
```

Also assert there is no bind mount to the repository's normal PostgreSQL or Redis data.

- [ ] **Step 2: Run the Compose test and confirm failure**

Run: `node --test load-tests/test/compose.test.mjs`

Expected: FAIL because `docker-compose.load.yml` does not exist.

- [ ] **Step 3: Add safe ignore rules and operator defaults**

Append exactly these entries to `.gitignore`:

```gitignore
# Local k6 capacity-test secrets and generated results
/load-tests/.runtime.env
/load-tests/results/
```

Create `load-tests/.env.load.example` with non-secret fields only:

```dotenv
MAX_VUS=1000
WARMUP_SECONDS=60
MEASURE_SECONDS=180
SOAK_SECONDS=1800
LOAD_HTTP_THROTTLE_LIMIT=1000000
LOAD_LOGIN_RATE_LIMIT_IP_MAX=100000
ALLOW_REMOTE_TARGET=false
```

- [ ] **Step 4: Implement the Compose file**

Use named volumes `auth-load-postgres` and `auth-load-redis`, network `auth-load`, and no explicit `container_name`. Key service settings:

```yaml
services:
  postgres-load:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: auth_load
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d auth_load"]
      interval: 2s
      timeout: 3s
      retries: 30
    volumes:
      - auth-load-postgres:/var/lib/postgresql/data
    networks: [auth-load]

  redis-load:
    image: redis:7-alpine
    command: ["redis-server", "--save", "", "--appendonly", "no"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 2s
      timeout: 3s
      retries: 30
    volumes:
      - auth-load-redis:/data
    networks: [auth-load]

  auth-service:
    build:
      context: .
      dockerfile: deploy/docker/Dockerfile.service
    environment:
      NODE_ENV: production
      DB_DRIVER: postgresql
      DB_HOST: postgres-load
      DB_PORT: "5432"
      DB_NAME: auth_load
      DB_USER: postgres
      DB_PASSWORD: ${DB_PASSWORD}
      REDIS_URL: redis://redis-load:6379
      OIDC_ISSUER: http://auth-service:3000
      OIDC_ACCESS_TOKEN_FORMAT: opaque
      OIDC_ADAPTER_DRIVER: hybrid
      OIDC_COOKIE_KEYS: ${OIDC_COOKIE_KEYS}
      OIDC_CACHE_TTL_MARGIN_SEC: "5"
      OIDC_CACHE_NEGATIVE_TTL_SEC: "3"
      OIDC_CACHE_BACKFILL_TTL_SEC: "60"
      JWKS_ENCRYPTION_KEY: ${JWKS_ENCRYPTION_KEY}
      OTP_TOKEN_SECRET: ${OTP_TOKEN_SECRET}
      OTP_PASSWORD_RESET_TTL_SEC: "900"
      ADMIN_USERNAME: loadtest-admin
      ADMIN_PASSWORD: ${ADMIN_PASSWORD}
      ADMIN_UI_URL: http://localhost:5173
      HTTP_THROTTLE_ENABLED: "true"
      HTTP_THROTTLE_TTL_MS: "60000"
      HTTP_THROTTLE_LIMIT: ${LOAD_HTTP_THROTTLE_LIMIT:-1000000}
      LOGIN_RATE_LIMIT_IP_MAX: ${LOAD_LOGIN_RATE_LIMIT_IP_MAX:-100000}
      LOGIN_RATE_LIMIT_IP_WINDOW_SEC: "60"
      LOGIN_FAILURE_MAX: "5"
      LOGIN_FAILURE_WINDOW_SEC: "900"
      LOGIN_LOCK_TTL_SEC: "900"
    ports:
      - "127.0.0.1:13000:3000"
    depends_on:
      postgres-load: { condition: service_healthy }
      redis-load: { condition: service_healthy }
    networks: [auth-load]

  k6:
    image: grafana/k6:2.2.0
    working_dir: /scripts
    environment:
      BASE_URL: http://auth-service:3000
      ADMIN_USERNAME: loadtest-admin
      ADMIN_PASSWORD: ${ADMIN_PASSWORD}
      LOAD_USER_PASSWORD: ${LOAD_USER_PASSWORD}
      SERVICE_CLIENT_SECRET: ${SERVICE_CLIENT_SECRET}
    volumes:
      - ./load-tests/k6:/scripts:ro
      - ./load-tests/results:/results
    depends_on:
      auth-service: { condition: service_started }
    networks: [auth-load]
```

Add service healthcheck, `restart: "no"`, memory/resource visibility without an artificial CPU limit, and top-level named volumes/network. Do not configure more than one service replica.

- [ ] **Step 5: Run Compose rendering and verify topology**

Run: `node --test load-tests/test/compose.test.mjs`

Expected: PASS.

Run: `docker compose --project-name auth-load -f docker-compose.load.yml --env-file load-tests/.env.load.example config --quiet`

Expected: exit 0 without creating containers.

- [ ] **Step 6: Commit**

```bash
git add .gitignore docker-compose.load.yml load-tests/.env.load.example load-tests/test/compose.test.mjs
git commit -m "feat(load): add isolated Docker topology"
```

---

### Task 4: Deterministic Test-Data Provisioning

**Files:**
- Create: `load-tests/k6/config.js`
- Create: `load-tests/k6/payloads.js`
- Create: `load-tests/k6/provision.js`
- Create: `load-tests/test/payloads.test.mjs`

**Interfaces:**
- Produces: `loadConfig(env): K6Config`
- Produces: `userNameFor(index: number): string`
- Produces: `tenantPayload()`, `offlineAccessScopePayload()`, `publicClientPayload(config)`, `serviceClientPayload(config)`, `signupPayload(index, config)`.
- Provisioning identifiers: tenant `loadtest-acme`, public client `loadtest-web`, service client `loadtest-resource-server`.
- Resource audience: `https://resource.loadtest.local`.

- [ ] **Step 1: Write failing payload tests**

Create `load-tests/test/payloads.test.mjs` and assert exact payloads. Include:

```js
test('public client enables refresh with provider-owned PKCE flow', () => {
  assert.deepEqual(publicClientPayload(config), {
    clientId: 'loadtest-web',
    name: 'Load Test Web',
    type: 'public',
    redirectUris: ['http://localhost:18080/callback'],
    grantTypes: ['authorization_code', 'refresh_token'],
    responseTypes: ['code'],
    tokenEndpointAuthMethod: 'none',
    scope: 'openid profile email offline_access',
    postLogoutRedirectUris: ['http://localhost:18080/logout'],
    applicationType: 'web',
    allowedResources: ['https://resource.loadtest.local'],
    skipConsent: true,
  });
});

test('service client can introspect only the load-test resource', () => {
  const payload = serviceClientPayload(config);
  assert.equal(payload.type, 'service');
  assert.equal(payload.tokenEndpointAuthMethod, 'client_secret_basic');
  assert.deepEqual(payload.introspectionResources, ['https://resource.loadtest.local']);
});

test('refresh-token scope is provisioned explicitly', () => {
  assert.deepEqual(offlineAccessScopePayload(), {
    name: 'offline_access',
    displayName: 'Offline access',
    claimKeys: [],
    enabled: true,
  });
});

test('each VU gets a stable unique user name', () => {
  assert.equal(userNameFor(1), 'loadtest-user-0001');
  assert.equal(userNameFor(1000), 'loadtest-user-1000');
});
```

- [ ] **Step 2: Run the payload tests and confirm failure**

Run: `node --test load-tests/test/payloads.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement environment validation and payload factories**

`load-tests/k6/config.js` must reject missing secrets without printing their values and must call the same hostname policy as the host module, implemented locally to keep k6 free of Node imports. `load-tests/k6/payloads.js` exports deterministic pure functions and never captures secrets at module initialization.

- [ ] **Step 4: Implement the provisioning scenario**

`provision.js` uses a `shared-iterations` scenario with `iterations: MAX_VUS`, `vus: min(MAX_VUS, 25)`, and `maxDuration: '30m'`.

In `setup()`:

1. `POST /admin/session` with the generated admin credential.
2. Extract `response.cookies.admin_session[0].value`; never log it.
3. `POST /admin/tenants` with `tenantPayload()` and Bearer auth.
4. `POST /t/loadtest-acme/admin/scopes` with `offlineAccessScopePayload()` because tenant creation seeds only `openid`, `profile`, and `email`.
5. `POST /t/loadtest-acme/admin/clients` for both client payloads.
6. Return no token or secret data from `setup()`.

Because VU functions cannot receive an admin token that is intentionally not returned, perform tenant/client creation in `setup()`, then provision users in the default function through public `/auth/signup?tenantCode=loadtest-acme`. Use `exec.scenario.iterationInTest + 1` as the stable user index:

```js
export default function () {
  const index = exec.scenario.iterationInTest + 1;
  const response = http.post(
    `${config.baseUrl}/auth/signup?tenantCode=${config.tenantCode}`,
    JSON.stringify(signupPayload(index, config)),
    { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'provision-user' } },
  );
  check(response, { 'user provisioned': (res) => res.status === 201 });
}
```

The script must define a threshold `checks: ['rate==1']` so partial provisioning fails fast at the runner boundary.

- [ ] **Step 5: Run unit and static k6 checks**

Run: `node --test load-tests/test/payloads.test.mjs`

Expected: PASS.

Run: `docker compose --project-name auth-load -f docker-compose.load.yml --env-file load-tests/.env.load.example run --rm --no-deps k6 inspect /scripts/provision.js`

Expected: exit 0; no HTTP requests are sent by `inspect`.

- [ ] **Step 6: Commit**

```bash
git add load-tests/k6/config.js load-tests/k6/payloads.js load-tests/k6/provision.js load-tests/test/payloads.test.mjs
git commit -m "feat(load): provision isolated OIDC test data"
```

---

### Task 5: Protocol-Correct OIDC User Journey

**Files:**
- Create: `load-tests/k6/flow-utils.js`
- Create: `load-tests/k6/metrics.js`
- Create: `load-tests/k6/oidc.js`
- Create: `load-tests/test/flow-utils.test.mjs`

**Interfaces:**
- Produces: `buildPkce(seed): { verifier: string, challenge: string }`
- Produces: `extractInteractionUid(location): string`
- Produces: `extractAuthorizationCode(location): string`
- Produces: `chooseAction(value): 'introspection' | 'userinfo' | 'refresh' | 'discovery' | 'jwks' | 'relogin'`
- Produces: `createOidcClient(config, metricRecorder): OidcClient`
- `OidcClient` methods: `login(userIndex, measuring): Session`, `introspect(session, measuring): void`, `userinfo(session, measuring): void`, `refresh(session, measuring): Session`, `discovery(measuring): void`, `jwks(measuring): void`, `revokeAndRelogin(session, userIndex, measuring): Session`, and `execute(action, session, userIndex, measuring): Session`.

- [ ] **Step 1: Write failing flow utility tests**

Test strict interaction paths, callback code parsing, rejected foreign hosts, username boundaries, and weighted action edges:

```js
test('chooseAction implements the approved cumulative weights', () => {
  assert.equal(chooseAction(0.00), 'introspection');
  assert.equal(chooseAction(0.449999), 'introspection');
  assert.equal(chooseAction(0.45), 'userinfo');
  assert.equal(chooseAction(0.70), 'refresh');
  assert.equal(chooseAction(0.82), 'discovery');
  assert.equal(chooseAction(0.90), 'jwks');
  assert.equal(chooseAction(0.95), 'relogin');
});

test('extractAuthorizationCode rejects callbacks without a code', () => {
  assert.throws(
    () => extractAuthorizationCode('http://localhost:18080/callback?error=access_denied'),
    /authorization code/,
  );
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `node --test load-tests/test/flow-utils.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement pure redirect and action utilities**

Implement the approved cumulative boundaries `0.45`, `0.70`, `0.82`, `0.90`, `0.95`, `1.00`. Redirect parsing must accept only the configured service origin for interaction/resume paths and only `http://localhost:18080/callback` for the final RP callback.

- [ ] **Step 4: Implement measurement-window metrics**

Create `load-tests/k6/metrics.js` with `Rate` metrics `load_request_failed`, `load_check_failed`; `Trend` metrics `load_http_req_duration_ms` and all seven names from `ENDPOINT_METRICS`; and `Counter` metrics for requests and completed login flows. `recordResponse({ response, endpoint, measuring, acceptedStatuses, runKind, minute })` adds samples only when `measuring` is true. For soak runs it adds a bounded `minute` tag from `0` through `29`; for other runs it adds no minute tag. Never use URL, username, token, code, or VU as a metric tag.

For `RUN_KIND=soak`, construct lenient threshold selectors such as `load_http_req_duration_ms{minute:0}: ['p(99)<1000000000']` for every minute and endpoint. These selectors exist only to make the bounded submetrics available in the final summary; the host evaluator applies the real SLO and the lenient thresholds must never classify capacity.

Export `handleK6Summary(data)` returning:

```js
export function handleK6Summary(data) {
  return {
    [__ENV.SUMMARY_PATH]: JSON.stringify(data),
  };
}
```

- [ ] **Step 5: Implement node-oidc-provider-driven OIDC operations**

In `load-tests/k6/oidc.js`:

- Build a verifier from a non-secret seed containing VU ID, iteration, and random bytes; hash with `crypto.sha256(verifier, 'base64rawurl')`.
- Send authorize requests with `redirects: 0`, `response_type=code`, `scope=openid profile email offline_access`, `resource=https://resource.loadtest.local`, `code_challenge_method=S256`, unique state and nonce, and `prompt=consent` so node-oidc-provider may issue a refresh token. For relogin use `prompt=login consent`. The client remains `skipConsent=true`, so `loadExistingGrant` creates the provider grant without a user consent submission.
- Fetch interaction details and submit username/password JSON.
- Follow only the returned provider resume path with `redirects: 0`.
- Exchange the code with form fields `grant_type`, `client_id`, `redirect_uri`, `code`, `code_verifier`, and `resource`.
- Verify the callback `state` equals the sent state.
- Require access and refresh tokens but never put their values into a check name or exception message.
- Introspect using `Authorization: Basic ${encoding.b64encode(`${clientId}:${secret}`)}` and form field `token`; require `active === true`.
- Refresh with the current token, replace both returned access and refresh tokens atomically, and never retry a failed refresh with the old token.
- Revoke the refresh token, clear cookies with `http.cookieJar().clear(config.baseUrl)`, discard token state, and perform a fresh login.

Every request sets `responseType: 'none'` unless its body must be parsed. Error messages contain only endpoint group, status code, and non-sensitive provider error code.

- [ ] **Step 6: Run utility tests**

Run: `node --test load-tests/test/flow-utils.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add load-tests/k6/flow-utils.js load-tests/k6/metrics.js load-tests/k6/oidc.js load-tests/test/flow-utils.test.mjs
git commit -m "feat(load): model the OIDC user journey"
```

---

### Task 6: Real-Usage Capacity Scenario

**Files:**
- Create: `load-tests/k6/journey.js`
- Create: `load-tests/k6/smoke.js`

**Interfaces:**
- Consumes: `loadConfig`, `chooseAction`, `createOidcClient`, and `handleK6Summary`.
- Reads: `VUS`, `WARMUP_SECONDS`, `MEASURE_SECONDS`, `SUMMARY_PATH`, and `RUN_KIND` (`probe`, `smoke`, or `soak`).
- Produces: one raw k6 summary file per runner-selected path.

- [ ] **Step 1: Add the scenario with a deliberately failing smoke assertion**

Create `journey.js` first with correct option parsing but an explicit temporary threshold `load_completed_login_flows: ['count<0']`. This makes static inspection succeed and runtime smoke fail until the real journey is connected.

```js
export const options = {
  scenarios: {
    users: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS),
      duration: `${Number(__ENV.WARMUP_SECONDS) + Number(__ENV.MEASURE_SECONDS)}s`,
      gracefulStop: '30s',
    },
  },
  summaryTrendStats: ['count', 'avg', 'max', 'p(95)', 'p(99)'],
  thresholds: {
    load_completed_login_flows: ['count<0'],
  },
};
```

- [ ] **Step 2: Inspect the script**

Run: `docker compose --project-name auth-load -f docker-compose.load.yml --env-file load-tests/.env.load.example run --rm --no-deps k6 inspect /scripts/journey.js`

Expected: exit 0 and show a `constant-vus` scenario.

- [ ] **Step 3: Connect session lifecycle and approved traffic weights**

Use module-scope VU-local state:

```js
let session;

export function setup() {
  return { measureAfterMs: Date.now() + config.warmupSeconds * 1000 };
}

export default function (timing) {
  const userIndex = exec.vu.idInTest;
  if (!session) session = oidc.login(userIndex, false);
  const measuring = Date.now() >= timing.measureAfterMs;
  const action = chooseAction(Math.random());
  session = oidc.execute(action, session, userIndex, measuring);
  sleep(1 + Math.random() * 2);
}
```

Replace the temporary threshold with no pass/fail thresholds. The host capacity engine owns SLO classification so an expected capacity breach does not become a harness exit error. Keep only `abortOnFail` preconditions that indicate invalid test data, such as zero successful initial logins; emit those through a dedicated `load_harness_failure` rate checked by the runner.

Export `handleSummary = handleK6Summary`.

- [ ] **Step 4: Add a deterministic smoke scenario**

Create `load-tests/k6/smoke.js` with one VU and one iteration. It must execute, in order, `login`, `introspect`, `userinfo`, `refresh`, `discovery`, `jwks`, and `revokeAndRelogin`, require all checks to pass, and write its summary through `handleK6Summary`. This script validates coverage of every OIDC action without relying on weighted randomness.

```js
export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ['rate==1'],
    load_harness_failure: ['rate==0'],
  },
  summaryTrendStats: ['count', 'avg', 'max', 'p(95)', 'p(99)'],
};

export default function () {
  let session = oidc.login(1, false);
  oidc.introspect(session, true);
  oidc.userinfo(session, true);
  session = oidc.refresh(session, true);
  oidc.discovery(true);
  oidc.jwks(true);
  oidc.revokeAndRelogin(session, 1, true);
}
```

- [ ] **Step 5: Inspect both executable scenarios**

Run: `docker compose --project-name auth-load -f docker-compose.load.yml --env-file load-tests/.env.load.example run --rm --no-deps k6 inspect /scripts/journey.js`

Expected: exit 0, exact VU count from `VUS`, exact combined duration, and summary trend stats containing p95 and p99.

Run: `docker compose --project-name auth-load -f docker-compose.load.yml --env-file load-tests/.env.load.example run --rm --no-deps k6 inspect /scripts/smoke.js`

Expected: exit 0 and show one VU with one iteration.

- [ ] **Step 6: Commit**

```bash
git add load-tests/k6/journey.js load-tests/k6/smoke.js
git commit -m "feat(load): add weighted capacity scenario"
```

---

### Task 7: Security Rate-Limit Profile

**Files:**
- Create: `load-tests/k6/rate-limit.js`
- Create: `load-tests/test/rate-limit.test.mjs`

**Interfaces:**
- Produces: `classifyLoginResponse(status): 'auth-rejected' | 'rate-limited' | 'unexpected'` from a pure export in `load-tests/k6/rate-limit-classifier.js`.
- Writes one k6 summary to `SUMMARY_PATH`.
- Requires at least one 429, zero 5xx responses, and no leaked response bodies.

- [ ] **Step 1: Write failing classification tests**

Create `load-tests/test/rate-limit.test.mjs`:

```js
test('classifies only expected authentication and throttling statuses', () => {
  assert.equal(classifyLoginResponse(401), 'auth-rejected');
  assert.equal(classifyLoginResponse(429), 'rate-limited');
  assert.equal(classifyLoginResponse(500), 'unexpected');
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `node --test load-tests/test/rate-limit.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the classifier and security script**

Create `load-tests/k6/rate-limit-classifier.js` with the exact three-way mapping. In `rate-limit.js`, run one VU for 15 sequential `POST /admin/session` requests using a generated nonexistent username and a fixed invalid password sourced from the runtime environment. Do not use the real admin username, so account lock state cannot affect provisioning.

Use custom counters `security_auth_rejected_total`, `security_rate_limited_total`, and `security_unexpected_total`. Add thresholds:

```js
export const options = {
  vus: 1,
  iterations: 15,
  thresholds: {
    security_rate_limited_total: ['count>0'],
    security_unexpected_total: ['count==0'],
  },
};
```

Accept only 401 before throttling and 429 after throttling. Set `responseType: 'none'` and write the raw summary through `handleK6Summary`.

- [ ] **Step 4: Run tests and inspect**

Run: `node --test load-tests/test/rate-limit.test.mjs`

Expected: PASS.

Run: `docker compose --project-name auth-load -f docker-compose.load.yml --env-file load-tests/.env.load.example run --rm --no-deps k6 inspect /scripts/rate-limit.js`

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add load-tests/k6/rate-limit-classifier.js load-tests/k6/rate-limit.js load-tests/test/rate-limit.test.mjs
git commit -m "test(load): verify local rate limiting"
```

---

### Task 8: Resource Monitoring and Workflow Orchestration

**Files:**
- Create: `load-tests/lib/monitor.mjs`
- Create: `load-tests/lib/orchestrator.mjs`
- Create: `load-tests/run-capacity.mjs`
- Create: `load-tests/test/monitor.test.mjs`
- Create: `load-tests/test/orchestrator.test.mjs`

**Interfaces:**
- Produces: `parseDockerStats(line): DockerSample`
- Produces: `parsePostgresConnectionCount(stdout): number`
- Produces: `parseRedisInfo(stdout): { connectedClients: number, usedMemoryBytes: number }`
- Produces: `startMonitor(deps, outputPath): { stop(): Promise<void> }`
- Produces: `runCapacityWorkflow(options, deps): Promise<CapacityReport>`
- Runner dependencies: `{ runCommand, fetchHealth, startMonitor, now, randomBytes, writeFile, mkdir, chmod }`.
- Consumes all Task 1 and Task 2 interfaces.

- [ ] **Step 1: Write failing monitoring parser tests**

Use fixture lines from `docker stats --no-stream --format '{{json .}}'`, `select count(*) from pg_stat_activity`, and `redis-cli INFO clients memory`. Assert malformed input throws without echoing raw input. Assert the monitor first resolves container IDs from `docker compose ... ps -q` and passes only those IDs to `docker stats`, so unrelated local containers are never sampled.

```js
test('parseRedisInfo returns only bounded operational fields', () => {
  assert.deepEqual(
    parseRedisInfo('# Clients\r\nconnected_clients:12\r\n# Memory\r\nused_memory:4096\r\n'),
    { connectedClients: 12, usedMemoryBytes: 4096 },
  );
});
```

- [ ] **Step 2: Write failing orchestration tests**

Inject a fake `runCommand` that records argv and creates summary fixtures. Cover:

- runtime env is written with mode `0600` before Compose starts;
- provisioning uses capacity limits;
- security service recreation uses limits `120` and `10`;
- capacity service recreation restores `1000000` and `100000`;
- coarse search stops at first failed evaluation;
- refinement probes the midpoint until the stop rule;
- soak runs at the last passing VU;
- all levels passing produces `atLeast: true`;
- smoke mode runs the deterministic smoke script and skips coarse, refinement, monitoring, and soak phases;
- a k6 nonzero exit with no summary is a harness error;
- a failed SLO summary remains a normal workflow result;
- `monitor.stop()` and `docker compose down --volumes` run in `finally` after success, exception, and simulated signal abort;
- cleanup argv contains the literal project name `auth-load` and never accepts it from user input.

- [ ] **Step 3: Run tests and confirm failure**

Run: `node --test load-tests/test/monitor.test.mjs load-tests/test/orchestrator.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 4: Implement bounded resource collection**

`startMonitor` samples every 5 seconds and appends one CSV row with timestamp, service CPU/memory/network, restart count, PostgreSQL connection count, Redis connected clients, and Redis used memory. Use these commands with argument arrays, never shell interpolation:

```js
['docker', ['compose', '--project-name', 'auth-load', '-f', 'docker-compose.load.yml', 'ps', '--format', 'json']]
['docker', ['compose', '--project-name', 'auth-load', '-f', 'docker-compose.load.yml', 'ps', '-q', 'auth-service', 'postgres-load', 'redis-load']]
['docker', ['stats', '--no-stream', '--format', '{{json .}}', ...dedicatedContainerIds]]
['docker', ['compose', '--project-name', 'auth-load', '-f', 'docker-compose.load.yml', 'exec', '-T', 'postgres-load', 'psql', '-U', 'postgres', '-d', 'auth_load', '-Atc', 'select count(*) from pg_stat_activity']]
['docker', ['compose', '--project-name', 'auth-load', '-f', 'docker-compose.load.yml', 'exec', '-T', 'redis-load', 'redis-cli', 'INFO', 'clients', 'memory']]
```

Do not include environment variables or command stderr in the CSV.

- [ ] **Step 5: Implement the dependency-injected workflow**

`runCapacityWorkflow` must execute these phases in order:

1. Validate options and local targets.
2. Create `load-tests/results/<UTC timestamp>/`.
3. Generate `.runtime.env`, write it with mode `0600`, and write sanitized `environment.json`.
4. Build and start the dedicated Compose project with capacity limits.
5. Poll `http://127.0.0.1:13000/health` for up to 120 seconds.
6. Run `provision.js` once with `MAX_VUS`.
7. Force-recreate only `auth-service` with security limits `120` and `10`; wait for health.
8. Run `rate-limit.js` and require its k6 thresholds to pass.
9. Force-recreate only `auth-service` with capacity limits `1000000` and `100000`; wait for health.
10. Run `smoke.js`; reject any harness/check failure. When `mode === 'smoke'`, write the smoke summary and jump to cleanup without running capacity probes.
11. Start resource monitoring for capacity mode.
12. Run coarse probes, normalize each summary, evaluate SLO, and stop at first failure.
13. Run refinement probes until `nextRefinementLevel` returns `null`.
14. If `lastPassingVus > 0`, run the 30-minute soak at that value with `RUN_KIND=soak`.
15. Normalize and evaluate all 30 one-minute soak buckets. Combine their earliest SLO violation with monitor restart/dependency samples to determine the first violation minute.
16. Write `capacity.json`, `soak.json`, and `summary.md` through Task 2.
17. Stop monitoring, remove `.runtime.env`, and execute `docker compose ... down --volumes --remove-orphans` in `finally`.

The k6 command builder must mount no new host path and pass only explicit non-secret control values on argv. Secrets already exist only in Compose container environment.

- [ ] **Step 6: Implement the executable entrypoint and signal handling**

`load-tests/run-capacity.mjs` imports `parseOptions` and `runCapacityWorkflow`, wires real Node dependencies with `spawn`, and handles signals without duplicating cleanup:

```js
const controller = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => controller.abort(new Error(`aborted by ${signal}`)));
}

try {
  const report = await runCapacityWorkflow(parseOptions(process.env), {
    ...nodeDependencies,
    signal: controller.signal,
  });
  process.stdout.write(`${report.summaryPath}\n`);
} catch (error) {
  process.stderr.write(`Load-test harness failed: ${safeErrorMessage(error)}\n`);
  process.exitCode = 1;
}
```

`safeErrorMessage` maps known errors to static descriptions plus non-sensitive status/phase. It must not serialize command environments, HTTP bodies, headers, or raw stderr.

- [ ] **Step 7: Run monitoring and orchestration tests**

Run: `node --test load-tests/test/monitor.test.mjs load-tests/test/orchestrator.test.mjs`

Expected: PASS.

- [ ] **Step 8: Run the complete unit suite**

Run: `node --test load-tests/test/*.test.mjs`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add load-tests/lib/monitor.mjs load-tests/lib/orchestrator.mjs load-tests/run-capacity.mjs load-tests/test/monitor.test.mjs load-tests/test/orchestrator.test.mjs
git commit -m "feat(load): orchestrate capacity search and monitoring"
```

---

### Task 9: Commands, Documentation, and End-to-End Verification

**Files:**
- Modify: `package.json`
- Create: `load-tests/README.md`
- Modify if verification exposes only harness defects: files created in Tasks 1–8, with a failing regression test added first.

**Interfaces:**
- Produces root commands `load:test:unit`, `load:test:config`, `load:test:smoke`, `load:test:capacity`, and `load:test:cleanup`.

- [ ] **Step 1: Add root scripts**

Add exactly:

```json
{
  "load:test:unit": "node --test load-tests/test/*.test.mjs",
  "load:test:config": "docker compose --project-name auth-load -f docker-compose.load.yml --env-file load-tests/.env.load.example config --quiet",
  "load:test:smoke": "LOAD_TEST_MODE=smoke MAX_VUS=1 node load-tests/run-capacity.mjs",
  "load:test:capacity": "node load-tests/run-capacity.mjs",
  "load:test:cleanup": "docker compose --project-name auth-load -f docker-compose.load.yml --env-file load-tests/.env.load.example down --volumes --remove-orphans"
}
```

Merge these keys into the existing root `scripts` object without reordering or changing unrelated scripts.

- [ ] **Step 2: Write the operator guide**

`load-tests/README.md` must document:

- Docker Desktop/Engine and Compose v2 prerequisites;
- that the harness builds one existing production service image and creates isolated data;
- the security and capacity profiles and why rate limits are separated;
- exact default traffic percentages and SLO;
- expected worst-case duration: provisioning + security check + smoke + coarse/refinement probes + 30-minute soak;
- `yarn load:test:unit`, `yarn load:test:config`, `yarn load:test:smoke`, `yarn load:test:capacity`, and cleanup commands;
- safe overrides for `MAX_VUS`, warm-up, measure, and soak durations;
- the remote-target refusal and no documented bypass example;
- result file meanings and the distinction between “maximum observed” and “at least N VUs”;
- local hardware and load-generator contention caveat;
- how to inspect `summary.md`, `capacity.json`, `soak.json`, and `docker-stats.csv`;
- that generated credentials and tokens are never retained.

- [ ] **Step 3: Run non-mutating verification**

Run: `yarn load:test:unit`

Expected: all load-test unit tests PASS.

Run: `yarn load:test:config`

Expected: exit 0.

Run: `yarn lint`

Expected: exit 0; if repository-wide unrelated lint failures exist, record them and run ESLint only against new JavaScript modules using the repository configuration.

- [ ] **Step 4: Run the 1-VU integration smoke**

Run: `yarn load:test:smoke`

Expected:

- one `auth-service` replica starts;
- provisioning, security-profile 429 verification, capacity-profile restart, OIDC login, PKCE token exchange, introspection, userinfo, refresh, discovery, JWKS, and revoke/relogin checks all execute;
- generated result files contain no secret/token fields;
- dedicated Compose containers and volumes are removed on completion;
- the smoke summary reports deterministic coverage of every configured endpoint and no capacity or soak result is claimed.

If this fails, invoke `superpowers:systematic-debugging`, add the smallest regression test reproducing the harness defect, and fix only load-test files. Do not modify service protocol or weaken validation to make the smoke pass.

- [ ] **Step 5: Verify cleanup idempotency and clean worktree scope**

Run: `yarn load:test:cleanup`

Expected: exit 0 even when the dedicated project is already absent.

Run: `git status --short`

Expected: only intentional implementation and documentation files are modified; no `.runtime.env`, `results/`, tokens, secrets, or generated DB files are tracked.

- [ ] **Step 6: Commit**

```bash
git add package.json load-tests/README.md
git commit -m "docs(load): document local capacity testing"
```

- [ ] **Step 7: Final verification before declaring completion**

Invoke `superpowers:verification-before-completion`, then rerun:

```bash
yarn load:test:unit
yarn load:test:config
yarn lint
git status --short
```

Report the 1-VU smoke separately from the full capacity result. Do not claim a maximum VU count until the operator runs `yarn load:test:capacity` to completion on the target local machine.
