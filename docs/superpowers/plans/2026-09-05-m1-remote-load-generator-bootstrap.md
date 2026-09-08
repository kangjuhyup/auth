# M1 Remote Load Generator Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone script that an operator downloads and executes on an M1 Mini to clone or safely update this repository and validate the pinned Docker-based k6 load-generator environment.

**Architecture:** A defensive Bash entrypoint owns argument parsing, repository synchronization, platform checks, and Docker/k6 validation. Node's built-in test runner drives the real script against temporary Git repositories while replacing only host boundaries (`uname` and `docker`) through `PATH`. The existing local capacity orchestrator and Auth service remain unchanged.

**Tech Stack:** Bash 3.2-compatible shell, Git, Docker Engine, `grafana/k6:2.2.0`, Node.js built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-05-m1-remote-load-generator-bootstrap-design.md`

## Global Constraints

- M1 Mini runs k6 only; the current PC runs Auth, PostgreSQL, Redis, and target monitoring.
- Default repository is exactly `https://github.com/kangjuhyup/auth.git`; default branch is `main`.
- `--directory` is required; `/` and the current user's home directory are rejected.
- Existing repositories must have the expected origin, a clean worktree, and accept only a fast-forward update.
- k6 image is pinned to exactly `grafana/k6:2.2.0` and its local Docker architecture must be `arm64`.
- No Auth port, remote-target guard, credentials, tokens, or runtime secret files are created or changed.
- `service/` and `ui/` must not be modified.

---

### Task 1: Standalone bootstrap script

**Files:**

- Create: `scripts/setup-remote-loadgen.sh`
- Create: `load-tests/test/remote-loadgen-setup.test.mjs`

**Interfaces:**

- Consumes: `git`, `docker`, `uname`, the selected repository URL/branch/destination, and the existing `load-tests/k6` checkout path.
- Produces: CLI `setup-remote-loadgen.sh --repo URL --branch NAME --directory PATH`, a clean checkout, pulled arm64 k6 image, and `load-tests/results/remote` with mode `0700`.

- [ ] **Step 1: Write the failing CLI safety tests**

Create a Node test fixture that initializes a temporary local Git remote and places fake `uname` and `docker` executables first in `PATH`. Invoke the script with `spawnSync('bash', [scriptPath, ...args])` and assert these literal behaviors:

```js
test('fresh setup clones the selected branch and validates pinned arm64 k6', () => {
  const result = runSetup([
    '--repo',
    remote,
    '--branch',
    'main',
    '--directory',
    checkout,
  ]);
  assert.equal(result.status, 0);
  assert.equal(readFileSync(join(checkout, 'version.txt'), 'utf8'), 'v1\n');
  assert.match(readFileSync(dockerLog, 'utf8'), /pull grafana\/k6:2\.2\.0/);
  assert.equal(
    statSync(join(checkout, 'load-tests/results/remote')).mode & 0o777,
    0o700,
  );
});

test('dirty existing checkout is rejected without changing user files', () => {
  writeFileSync(join(checkout, 'local-change.txt'), 'keep\n');
  const result = runSetup([
    '--repo',
    remote,
    '--branch',
    'main',
    '--directory',
    checkout,
  ]);
  assert.notEqual(result.status, 0);
  assert.equal(
    readFileSync(join(checkout, 'local-change.txt'), 'utf8'),
    'keep\n',
  );
});
```

Add separate tests for `--help`, missing/unsafe destinations, origin mismatch, unsupported architecture, stopped Docker, non-arm64 k6, fast-forward update, and an idempotent rerun.

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
node --test load-tests/test/remote-loadgen-setup.test.mjs
```

Expected: FAIL because `scripts/setup-remote-loadgen.sh` does not exist.

- [ ] **Step 3: Implement strict argument and platform validation**

Implement Bash 3.2-compatible parsing with `set -euo pipefail`, quoted arrays, `fail()` and `usage()` helpers. Require `Darwin`, `arm64`, Git, Docker, a running daemon, and an explicit safe directory. Docker Compose is not required on the k6-only generator. Never use `eval`, glob-derived targets, recursive deletion, or secret environment variables.

```bash
K6_IMAGE='grafana/k6:2.2.0'
DEFAULT_REPO='https://github.com/kangjuhyup/auth.git'
DEFAULT_BRANCH='main'

fail() {
  printf 'Remote load-generator setup failed: %s\n' "$1" >&2
  exit 1
}
```

- [ ] **Step 4: Implement safe clone and fast-forward update**

For a missing destination, create only its parent and run:

```bash
git clone --single-branch --branch "$branch" "$repo" "$directory"
```

For an existing checkout, compare `git remote get-url origin`, require an empty `git status --porcelain`, fetch the requested branch, check it out, and run `git merge --ff-only "origin/$branch"`. Leave every failure in place for inspection.

- [ ] **Step 5: Implement pinned Docker/k6 validation**

Pull the exact image, validate `docker image inspect --format '{{.Architecture}}'` equals `arm64`, run `docker run --rm "$K6_IMAGE" version`, create `load-tests/results/remote`, and apply mode `0700`. Print only repository path, branch, image, architecture, and readiness status.

- [ ] **Step 6: Run tests and verify GREEN**

Run:

```bash
node --test load-tests/test/remote-loadgen-setup.test.mjs
yarn load:test:unit
bash -n scripts/setup-remote-loadgen.sh
yarn eslint load-tests/test/remote-loadgen-setup.test.mjs
```

Expected: all tests pass, shell syntax exits 0, and ESLint reports no errors.

- [ ] **Step 7: Commit Task 1**

```bash
git add scripts/setup-remote-loadgen.sh load-tests/test/remote-loadgen-setup.test.mjs
git commit -m "feat(load): add M1 load generator bootstrap"
```

### Task 2: Download and operating guide

**Files:**

- Modify: `load-tests/README.md`

**Interfaces:**

- Consumes: published raw GitHub URL for `scripts/setup-remote-loadgen.sh` and Task 1 CLI options.
- Produces: copyable download, inspection, execution, rerun, and troubleshooting commands for the M1 Mini.

- [ ] **Step 1: Document the safe download flow**

Add an `M1 remote load-generator bootstrap` section with commands that download to a file rather than pipe into Bash:

```bash
curl --proto '=https' --tlsv1.2 --fail --location \
  --output setup-remote-loadgen.sh \
  https://raw.githubusercontent.com/kangjuhyup/auth/main/scripts/setup-remote-loadgen.sh
chmod 700 setup-remote-loadgen.sh
./setup-remote-loadgen.sh --branch main --directory "$PWD/auth-loadgen"
```

Document that the raw URL works after the script reaches the selected remote branch, the script is safe to rerun on a clean checkout, and dirty/wrong-origin repositories are preserved and rejected.

- [ ] **Step 2: Document the machine boundary**

State that the bootstrap prepares only the M1 generator. It does not expose `192.168.0.18`, transfer secrets, or start remote capacity traffic. Explain that production-equivalent TLS and an explicitly allowlisted remote runner are required before actual OIDC load is sent.

- [ ] **Step 3: Verify documentation and the full change**

Run:

```bash
yarn prettier --check load-tests/README.md docs/superpowers/specs/2026-09-05-m1-remote-load-generator-bootstrap-design.md docs/superpowers/plans/2026-09-05-m1-remote-load-generator-bootstrap.md
yarn load:test:unit
yarn eslint load-tests/test/remote-loadgen-setup.test.mjs
bash -n scripts/setup-remote-loadgen.sh
git diff --check
git diff --name-only -- service ui
```

Expected: formatting, tests, lint, shell syntax, and diff checks pass; the final scope command prints nothing.

- [ ] **Step 4: Commit Task 2**

```bash
git add load-tests/README.md
git commit -m "docs(load): explain M1 generator setup"
```
