# mTLS Remote Load Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a direct, test-only mTLS path from the M1 Mini to the Auth PC and a guarded M1 runner for a 300-VU probe followed by a 30-minute soak.

**Architecture:** A Compose overlay publishes an Nginx mTLS gateway on the Auth PC's exact LAN address and proxies to the private Auth service. Test-only OpenSSL tooling creates a dedicated CA/server/client hierarchy, while k6 loads the client certificate through `tlsAuth` and trusts the mounted CA without disabling TLS verification. Host and generator scripts keep setup, execution, result collection, and cleanup explicit.

**Tech Stack:** Docker Compose, Nginx 1.28 Alpine, OpenSSL 3, Bash 3.2, Grafana k6 2.2.0, Node.js built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-05-mtls-remote-load-path-design.md`

## Global Constraints

- M1 Mini is load-generation-only; Auth PC runs Auth, PostgreSQL, Redis, and gateway. Remote target monitoring and remote report/chart CLI automation are deferred by user scope ruling; retain raw JSON for later reporting.
- External issuer and k6 base URL are exactly `https://auth-service:13443`.
- Gateway binds exactly `${LOAD_GATEWAY_BIND_IP}:13443`; the documented value is `192.168.0.18`, never `0.0.0.0`.
- Auth upstream stays private at `http://auth-service:3000`; the existing loopback health port remains `127.0.0.1:13000`.
- No router port forwarding, SSH load tunnel, TLS verification bypass, or plaintext remote endpoint is allowed.
- CA and server private keys never leave the Auth PC; generated private keys are mode `0600` beneath gitignored paths.
- k6 base image remains exactly `grafana/k6:2.2.0`; Nginx image is exactly `nginx:1.28.0-alpine`.
- `service/` and `ui/` application code are not modified.

---

### Task 1: Test-only PKI lifecycle

**Files:**

- Create: `scripts/setup-remote-mtls.sh`
- Create: `load-tests/test/remote-mtls-setup.test.mjs`
- Modify: `.gitignore`

**Interfaces:**

- Consumes: `setup-remote-mtls.sh --target-ip IPv4 [--output-directory PATH]`, OpenSSL, and an explicit directory confined beneath `load-tests/.remote-tls` by default.
- Produces: `ca/ca.crt`, `ca/ca.key`, `server/server.crt`, `server/server.key`, `client/ca.crt`, `client/client.crt`, and `client/client.key` with restrictive permissions.

- [ ] **Step 1: Write failing PKI CLI tests**

Create a temporary output directory and invoke the real script. Assert that an
empty, wildcard, loopback, public, or malformed target IP fails; a private
`192.168.0.18` target succeeds; every expected file exists; private keys are
mode `0600`; and no PEM body appears in stdout/stderr.

```js
test('creates a purpose-limited CA, server, and M1 client bundle', () => {
  const result = runSetup([
    '--target-ip',
    '192.168.0.18',
    '--output-directory',
    output,
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(statSync(join(output, 'ca/ca.key')).mode & 0o777, 0o600);
  assert.match(
    opensslText(join(output, 'server/server.crt')),
    /DNS:auth-service/,
  );
  assert.match(
    opensslText(join(output, 'server/server.crt')),
    /IP Address:192\.168\.0\.18/,
  );
  assert.match(
    opensslText(join(output, 'client/client.crt')),
    /TLS Web Client Authentication/,
  );
  assert.doesNotMatch(
    `${result.stdout}${result.stderr}`,
    /BEGIN (?:CERTIFICATE|PRIVATE KEY)/,
  );
});
```

- [ ] **Step 2: Run the PKI test and verify RED**

Run `node --test load-tests/test/remote-mtls-setup.test.mjs`.

Expected: FAIL because `scripts/setup-remote-mtls.sh` does not exist.

- [ ] **Step 3: Implement minimal PKI generation**

Use Bash 3.2-compatible parsing, `set -euo pipefail`, private-RFC1918 address
validation, `umask 077`, temporary OpenSSL extension files, 3072-bit RSA keys,
SHA-256 signatures, random serials, explicit `serverAuth`/`clientAuth`, and
atomic generation into an absent or empty destination. Reject symlinked path
components and never print certificate/key material.

- [ ] **Step 4: Verify GREEN and certificate semantics**

Run:

```sh
node --test load-tests/test/remote-mtls-setup.test.mjs
bash -n scripts/setup-remote-mtls.sh
openssl verify -CAfile load-tests/.remote-tls/ca/ca.crt load-tests/.remote-tls/server/server.crt
openssl verify -CAfile load-tests/.remote-tls/ca/ca.crt load-tests/.remote-tls/client/client.crt
```

Expected: tests pass, shell syntax exits 0, and both certificates verify.

- [ ] **Step 5: Commit Task 1**

```sh
git add .gitignore scripts/setup-remote-mtls.sh load-tests/test/remote-mtls-setup.test.mjs
git commit -m "feat(load): add remote mTLS certificate setup"
```

### Task 2: mTLS gateway overlay

**Files:**

- Create: `docker-compose.remote-load.yml`
- Create: `load-tests/gateway/nginx.conf`
- Modify: `docker-compose.load.yml`
- Modify: `load-tests/test/compose.test.mjs`

**Interfaces:**

- Consumes: `LOAD_GATEWAY_BIND_IP`, `LOAD_OIDC_ISSUER`, and Task 1 files under `load-tests/.remote-tls/`.
- Produces: Compose service `load-gateway` at `${LOAD_GATEWAY_BIND_IP}:13443`, proxying privately to `auth-service:3000` and requiring the generated client CA.

- [ ] **Step 1: Write failing Compose overlay assertions**

Render both Compose files with synthetic secrets and
`LOAD_GATEWAY_BIND_IP=192.168.0.18`. Assert the gateway image is exactly
`nginx:1.28.0-alpine`, the published host IP and port are exact, all certificate
mounts are read-only, the upstream has no LAN-published port, and the Auth issuer
is `https://auth-service:13443`.

- [ ] **Step 2: Run the Compose test and verify RED**

Run `node --test load-tests/test/compose.test.mjs`.

Expected: FAIL because `docker-compose.remote-load.yml` and the gateway service
do not exist.

- [ ] **Step 3: Implement the overlay and gateway configuration**

Parameterize the base Auth issuer with the unchanged local default. Add the
overlay service with exact bind interpolation, read-only config/certificate
mounts, private `auth-load` networking, TLS 1.2/1.3, mandatory client
verification, bounded proxy timeouts, and a log format that excludes query
strings, request bodies, headers, cookies, and certificate data.

- [ ] **Step 4: Verify GREEN and live mTLS rejection/acceptance**

Run the Compose test and render validation, then start the overlay. Use `curl`
with the CA only and assert TLS rejection; use an unrelated client certificate
and assert rejection; use the generated M1 certificate and assert HTTP 200 from
`/health`.

- [ ] **Step 5: Commit Task 2**

```sh
git add docker-compose.load.yml docker-compose.remote-load.yml load-tests/gateway/nginx.conf load-tests/test/compose.test.mjs
git commit -m "feat(load): add LAN-bound mTLS gateway"
```

### Task 3: k6 mTLS configuration and guarded M1 runner

**Files:**

- Create: `load-tests/k6/tls.js`
- Create: `scripts/run-remote-loadgen.sh`
- Create: `load-tests/test/remote-loadgen-runner.test.mjs`
- Modify: `load-tests/k6/provision.js`
- Modify: `load-tests/k6/smoke.js`
- Modify: `load-tests/k6/journey.js`
- Modify: `load-tests/k6/rate-limit.js`
- Modify: `load-tests/test/flow-utils.test.mjs`

**Interfaces:**

- Consumes: `REMOTE_MTLS=true`, fixed `/certs/client.crt` and `/certs/client.key`, `run-remote-loadgen.sh verify|probe|soak`, `--target-ip`, `--vus`, and optional bounded duration overrides.
- Produces: k6 `tlsAuth` scoped to `auth-service`, TLS 1.2-or-newer options, timestamped summary JSON, and Docker commands with a read-only client bundle and explicit host mapping.

- [ ] **Step 1: Write failing k6 TLS and runner tests**

Add pure tests that local mode produces no `tlsAuth`, remote mode rejects HTTP
or another host, and valid remote mode returns the fixed domains and TLS range.
Drive the runner with fake `docker`, `uname`, and file fixtures. Assert
`verify`, `probe`, and `soak` construct expected k6 commands; default probe is
300 VUs with 60/180-second windows; default soak is 300 VUs for 1,800 seconds;
and no command contains `insecure-skip-tls-verify`.

- [ ] **Step 2: Run the new tests and verify RED**

Run:

```sh
node --test load-tests/test/remote-loadgen-runner.test.mjs load-tests/test/flow-utils.test.mjs
```

Expected: FAIL because the TLS helper and runner do not exist.

- [ ] **Step 3: Implement k6 TLS options**

Export `loadTlsOptions(env, readFile = open)` from `tls.js`. It returns an empty
frozen object unless `REMOTE_MTLS=true`; remote mode requires the exact HTTPS
origin and reads only `/certs/client.crt` and `/certs/client.key`. Spread the
returned options into every k6 script's exported options so provisioning and
all test phases share the same transport boundary.

- [ ] **Step 4: Implement the guarded M1 runner**

Use strict Bash parsing and validation. Require macOS arm64, Docker, a private
target IPv4, exact base URL, mode-`0600` or stricter secret/key files, and safe
non-symlink result paths. Mount scripts/results/client files read-only where
appropriate, mount `client/ca.crt` at the container CA bundle path, pass only
the named required environment values, and use
`--add-host auth-service:${target_ip}`. `verify` first performs a one-request
health script and then runs `smoke.js`; `probe` runs `journey.js` with probe
controls; `soak` runs it with `RUN_KIND=soak` and the bounded duration.

- [ ] **Step 5: Verify GREEN**

Run the targeted tests, shell syntax, ESLint, and a real one-request mTLS health
call through Docker k6. Expected: every check passes and the result directory
contains only timestamped summaries owned by the invoking user.

- [ ] **Step 6: Commit Task 3**

```sh
git add load-tests/k6 scripts/run-remote-loadgen.sh load-tests/test/remote-loadgen-runner.test.mjs load-tests/test/flow-utils.test.mjs
git commit -m "feat(load): run remote k6 through mTLS"
```

### Task 4: Operator guide and full verification

**Files:**

- Modify: `load-tests/README.md`
- Modify: `docs/docs/operations/load-test-2026-09-02.md`

**Interfaces:**

- Consumes: Tasks 1-3 scripts and fixed machine roles/addresses.
- Produces: copyable Auth-PC/M1 setup, verification, probe, soak, raw-result copy-back, and explicit cleanup commands.

- [ ] **Step 1: Document the exact two-machine runbook**

Add commands for PKI generation, overlay startup, certificate-only SCP,
M1 `verify`, 300-VU probe, 300-VU 30-minute soak, raw-result copy-back, and
both-machine cleanup. Remote monitoring/report automation is deferred; retain
raw JSON for later reporting. Label a failed probe as invalid for capacity
conclusions.

- [ ] **Step 2: Run complete verification**

Run:

```sh
node --test load-tests/test/*.test.mjs
bash -n scripts/setup-remote-mtls.sh scripts/run-remote-loadgen.sh scripts/setup-remote-loadgen.sh
docker compose --project-name auth-load -f docker-compose.load.yml --env-file load-tests/.env.load.example config --quiet
LOAD_GATEWAY_BIND_IP=192.168.0.18 LOAD_OIDC_ISSUER=https://auth-service:13443 docker compose --project-name auth-load -f docker-compose.load.yml -f docker-compose.remote-load.yml --env-file load-tests/.env.load.example config --quiet
yarn eslint load-tests/k6 load-tests/test
yarn prettier --check load-tests/README.md docs/docs/operations/load-test-2026-09-02.md docs/superpowers/specs/2026-09-05-mtls-remote-load-path-design.md docs/superpowers/plans/2026-09-05-mtls-remote-load-path.md
git diff --check
git diff --name-only -- service ui
```

Expected: all tests and static checks pass; both Compose configurations render;
the final scope command prints nothing.

- [ ] **Step 3: Commit Task 4**

```sh
git add load-tests/README.md docs/docs/operations/load-test-2026-09-02.md
git commit -m "docs(load): add remote mTLS test runbook"
```
