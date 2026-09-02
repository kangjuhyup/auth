# Task 9 report

## Commit

- Implementation commit: `dc1f4523448299ed0cfe6add4489732d1c6c0f01`
- Base HEAD: `fd1b3d6907c4af3a13d5ae42e59514ad46d9cf26`

## Delivered

- Added exactly the five specified root load-test scripts without changing or
  reordering unrelated scripts.
- Added the local k6 operator guide with prerequisites, isolated single-instance
  topology, security/capacity profiles, workload percentages, strict SLOs,
  worst-case duration, commands and bounded overrides, remote refusal, result
  interpretation, inspection order, hardware caveats, and credential/token
  non-retention.
- Fixed only smoke-exposed load-harness defects, with a failing regression test
  before each behavior change:
  - changed the invalid `.local` resource audience to an accepted HTTPS origin;
  - aligned the container summary path with the host timestamp result directory;
  - allowed that bounded timestamp directory in k6 summary-path validation;
  - replaced the unavailable browser `URL` dependency with strict redirect
    parsing;
  - followed one validated `prompt: consent` continuation after login resume,
    reusing the strict provider origin/resume-path checks and failing closed;
  - separated resource-audience tokens from the audience-less UserInfo token,
    while keeping provider-owned PKCE, interaction, consent, refresh, and revoke
    behavior. Initial `prompt=consent` and relogin `prompt=login consent` remain
    unchanged.

No `service/` or `ui/` file was modified. No provider/security validation or
guard was disabled or weakened.

## Verification

- `yarn load:test:unit`: PASS, 103 tests, 0 failures.
- `yarn load:test:config`: PASS, exit 0. Compose reported only unset variable
  names from the checked-in example environment; no values were printed.
- `yarn prettier --check ...` for every intentionally changed JSON, Markdown,
  JavaScript, and MJS file: PASS.
- `git diff --check`: PASS.
- `yarn lint`: repository-wide pre-existing failure, 380 problems (379 errors,
  1 warning). The remaining paths include existing `service/`, `ui/`, and
  Task 1–8 load-harness files. No `service/` or `ui/` diff exists in this task.
- Targeted ESLint over the intentionally changed load-harness modules: the only
  remaining failures are 9 pre-existing `no-undef` reports for k6's `__ENV`
  global in `load-tests/k6/metrics.js`; this usage was present at the base HEAD.

## Required live smoke

- Command: `yarn load:test:smoke`
- Result: PASS, exit 0.
- Smoke result: `load-tests/results/2026-09-02T15-39-22-553Z/smoke.json`
- Security-gate result:
  `load-tests/results/2026-09-02T15-39-22-553Z/security.json`
- Allowlisted observations:
  - checks: 78 passed, 0 failed, rate 1;
  - harness failure rate: 0;
  - deterministic endpoint counts: login 16, introspection 1, UserInfo 1,
    refresh 1, discovery 1, JWKS 1, revoke 1;
  - security classifications: 9 authentication rejections, 6 rate-limited
    responses, 0 unexpected responses;
  - suspicious secret/token/code/cookie/body/URL field names within the
    allowlisted result structures: 0.
- The final timestamp directory contains only `environment.json`,
  `security.json`, and `smoke.json`. It contains no capacity, soak, or summary
  claim. No maximum-VU or endurance claim is made here.

Only allowlisted result keys and field names were inspected. Runtime environment
contents, credentials, tokens, authorization codes, cookies, response bodies,
and response URLs were not printed or retained.

## Cleanup proof

- The smoke's `finally` cleanup left 0 `auth-load` service containers and 0
  `auth-load` volumes.
- `yarn load:test:cleanup` was then run twice; both invocations exited 0.
- After the repeated cleanup: 0 containers, 0 volumes, 0 networks carrying the
  literal `com.docker.compose.project=auth-load` label.
- `load-tests/.runtime.env` was absent after smoke and after repeated cleanup.
- Generated result directories remain gitignored and are not tracked.

## Intentional files

- `package.json`
- `load-tests/README.md`
- `load-tests/k6/config.js`
- `load-tests/k6/flow-utils.js`
- `load-tests/k6/metrics.js`
- `load-tests/k6/oidc.js`
- `load-tests/k6/payloads.js`
- `load-tests/lib/orchestrator.mjs`
- `load-tests/test/flow-utils.test.mjs`
- `load-tests/test/orchestrator.test.mjs`
- `load-tests/test/payloads.test.mjs`
- `.superpowers/sdd/2026-09-02-k6-local-capacity-test/task-9-report.md`

## Concerns and handoff

- The required live smoke is successful, but repository-wide lint remains red
  for the pre-existing issues described above.
- The full `yarn load:test:capacity` command was intentionally not run. The
  controller must run it only after final review on the intended local machine.
- UserInfo cannot accept an RFC 8707 resource-audience access token in the
  configured provider. The harness therefore obtains a separate audience-less
  UserInfo token through the same validated provider flow; this adds
  authorization traffic to logical login/relogin setup and is reflected in the
  observed login endpoint count.
