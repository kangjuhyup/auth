# Local k6 capacity test

This harness measures one locally containerized `auth-service` instance with
protocol-correct OIDC traffic. It builds the existing production service image
from `deploy/docker/Dockerfile.service` and creates dedicated PostgreSQL, Redis,
network, and volume data under the literal Compose project `auth-load`. It does
not use or modify the normal development stack or its data.

## Prerequisites

- Node.js 24 or newer and the repository's Yarn 4 installation
- Docker Desktop, or Docker Engine with the Docker Compose plugin v2 or newer
- Enough free CPU, memory, and disk space to build the service and run the
  service, PostgreSQL, Redis, and k6 containers concurrently

Run commands from the repository root. No separately running service is
required.

On hosts that expose numeric process ownership (including native Linux), the
runner computes the current UID and GID and runs k6 with that identity. This
lets k6 write into the host-owned, mode-`0700` result directory without making
it world-writable. Host-provided `LOAD_TEST_UID` or `LOAD_TEST_GID` values are
ignored; platforms without numeric ownership use the Compose defaults.

## Profiles and workload

Every run first provisions isolated test data. The security profile then runs
with the normal rate-limit settings and must observe the intended HTTP 429. The
service is subsequently recreated with high but still enabled rate-limit
thresholds for the capacity profile. Keeping these profiles separate proves
that the guards work without allowing a single load-generator IP to become the
capacity limit being measured. Redirect validation, PKCE S256, sessions,
interactions, token handling, and the other provider checks remain enabled.

After each VU performs a complete OIDC login, steady-state actions use this
default mix:

| Traffic                        | Share |
| ------------------------------ | ----: |
| Opaque-token introspection     |   45% |
| UserInfo                       |   25% |
| Refresh-token rotation         |   12% |
| Discovery                      |    8% |
| JWKS                           |    5% |
| Revoke/logout and full relogin |    5% |

Every measured probe and soak window must satisfy all of these conditions:

- request failure rate is strictly less than 1%;
- overall and endpoint p95 latency is strictly less than 1,000 ms;
- overall and endpoint p99 latency is strictly less than 2,000 ms;
- normal-flow check failures are zero;
- the expected auth, PostgreSQL, and Redis containers remain present and
  running, with zero restarts; and
- PostgreSQL and Redis connection errors are zero.

The default full run includes image build and provisioning, the security check,
a deterministic 1-VU smoke, coarse probes, refinement probes, and a 30-minute
soak. Each capacity probe has a 60-second warm-up and 180-second measurement.
At the default 1,000-VU ceiling, the longest search path is approximately 40
minutes of probe windows, followed by the 30-minute soak. Allow additional time
for the image build, provisioning, service recreations, security check, smoke,
health waits, and cleanup; machine and network speed determine that overhead.

## Commands

Run fast verification without starting the measured stack:

```sh
yarn load:test:unit
yarn load:test:config
```

Run the isolated, deterministic 1-VU integration smoke:

```sh
yarn load:test:smoke
```

Run the complete capacity search and soak only on the local machine whose
capacity you intend to measure:

```sh
yarn load:test:capacity
```

Cleanup is safe to repeat and affects only the `auth-load` Compose project:

```sh
yarn load:test:cleanup
```

The capacity command accepts positive integer overrides. `SOAK_SECONDS` is
bounded to 1–1800 seconds; shorter values are useful for a rehearsal but do not
constitute the default 30-minute endurance result.

```sh
MAX_VUS=200 WARMUP_SECONDS=30 MEASURE_SECONDS=120 SOAK_SECONDS=300 yarn load:test:capacity
```

The harness accepts only its dedicated Compose service name and local loopback
targets by default. It refuses a non-local or remote target. This guide
intentionally provides no bypass command: capacity traffic must not be aimed at
a shared or production environment by copying an operator example.

## M1 remote load-generator bootstrap

The current PC at `192.168.0.18` continues to run Auth, PostgreSQL, Redis, and
monitoring. The M1 Mini is a load-generator-only machine, and this bootstrap
only prepares Docker-based k6 on it. It does not expose ports on the current PC,
transfer secrets, start the Auth stack, or send capacity traffic.

Before any remote OIDC load is sent in a later, separately authorized step, the
target must use production-equivalent TLS, the remote runner must be explicitly
allowlisted, and required secrets must be transferred ephemerally. Do not
disable the harness's target guards, TLS verification, or authentication
controls to make a remote run work.

On the M1 Mini, download the bootstrap script to a file from the selected
branch. The raw URL works only after the script exists on that remote branch;
for the default flow, that means the script must already be published on
`main`.

```sh
curl --proto '=https' --tlsv1.2 --fail --location \
  --output setup-remote-loadgen.sh \
  https://raw.githubusercontent.com/kangjuhyup/auth/main/scripts/setup-remote-loadgen.sh
```

Inspect the downloaded file before granting execute permission. Never pipe the
download into a shell.

```sh
sed -n '1,260p' setup-remote-loadgen.sh
chmod 700 setup-remote-loadgen.sh
./setup-remote-loadgen.sh --branch main --directory "$PWD/auth-loadgen"
```

The defaults are repository `https://github.com/kangjuhyup/auth.git`, branch
`main`, and k6 image `grafana/k6:2.2.0`. The explicit `--branch main` above makes
the selected revision visible at the call site.

The same execution command is safe to rerun when `auth-loadgen` is a clean
checkout with that exact origin. The script fetches the selected branch and
updates it only by fast-forward. If the checkout is dirty, has untracked files,
has a different origin, is not the checkout root, or cannot fast-forward, the
script rejects it without discarding or overwriting the existing repository.
Resolve the repository state deliberately, or choose a new destination; do not
delete local work just to make the bootstrap pass.

For a rejected setup, inspect the M1 prerequisites and destination without
printing environment variables or secret material:

```sh
uname -s
uname -m
git --version
docker --version
docker info
git -C "$PWD/auth-loadgen" remote get-url origin
git -C "$PWD/auth-loadgen" status --short
docker image inspect --format '{{.Architecture}}' grafana/k6:2.2.0
docker run --rm grafana/k6:2.2.0 version
```

Expected platform values are `Darwin` and `arm64`. The bootstrap requires a
reachable Docker daemon but does not require Docker Compose because the M1 is a
k6-only generator. It also verifies the exact
repository origin and clean state, checks required load-test assets, confirms
the pulled image is `arm64`, and creates the gitignored
`load-tests/results/remote/` directory with mode `0700`.

## Results and interpretation

Generated artifacts are written beneath the gitignored
`load-tests/results/<timestamp>/` directory. A full capacity run produces:

- `summary.md`: the human-readable conclusion, allowlisted host/image context,
  configured traffic mix, bounded rate-limit evidence, per-probe VU/RPS and
  latency/failure/endpoint counts, search bracket, soak outcome, the earliest
  failing phase's correlated candidate, and aggregate container/dependency
  bottleneck evidence;
- `capacity.json`: each coarse and refinement probe, its SLO evaluation, the last
  passing VU level, and the first failing VU level;
- `soak.json`: bounded soak windows, their evaluations, and the first violation
  minute when one exists, or a bounded `INTERRUPTED` record when trusted
  terminal evidence proves an expected container stopped or disappeared before
  k6 could write its summary;
- `docker-stats.csv`: time-series CPU, memory, network, container state,
  restart count, container exit code/OOM observation, and dependency samples;
- `environment.json` plus per-phase k6 summaries: allowlisted run context and
  machine-readable observations used to construct the report.

Reported RPS is derived from measured observations, never from k6's raw Counter
rate (whose denominator includes the whole scenario and therefore warm-up).
Probe RPS is `load_requests.count / MEASURE_SECONDS`. Each soak window uses its
exact measured length: 60 seconds for a full minute and the remaining seconds
for a partial final bucket. `capacity.json`, `soak.json`, and `summary.md` retain
these canonical values; the summary also lists each soak window's denominator.

Start with `summary.md`, confirm the search bracket in `capacity.json`, inspect
the time and failure window in `soak.json`, then correlate it with resource and
restart samples in `docker-stats.csv`. Treat a reported maximum as the maximum
**observed** passing level within this run and search bracket. If every probe up
to `MAX_VUS` passes, the result is only “at least N VUs” at the configured search
cap, not proof that N is the service's absolute maximum.

The correlated bottleneck entry is explicitly a candidate, not a causal claim.
It selects the highest-p99 required endpoint from the earliest failing probe or
soak window and pairs it only with allowlisted resource, status, restart, and
dependency peaks collected for that same phase. If either side has no bounded
observation, the report says `insufficient evidence`; the full-run monitor table
remains available as raw aggregate evidence.

For soak runs, k6 `setup()` establishes one measurement epoch shared by every
VU and emits it exactly once in the k6 summary. After k6 exits, the host monitor
drains pending collection, takes a terminal sample, validates that single epoch,
and uses it as the sole anchor for minute buckets. Samples on the exact final
measurement edge belong to the final bucket; stopped or missing expected
containers remain explicit SLO failures rather than being discarded as generic
command output. Initial logins during the nonzero warm-up do not emit custom SLO
samples and do not resolve a minute tag. Once measurement begins, a sample
without a valid epoch-derived minute still fails closed.

If k6 exits nonzero during initial login or warm-up and its partial summary lacks
the required aggregate metrics, the runner records zero observations only when
the phase-local trusted monitor sample proves an expected auth, PostgreSQL, or
Redis container is stopped or missing. A malformed present metric, a zero k6
exit, or missing exact infrastructure evidence remains a harness error.

If k6 cannot write any soak summary, the same exception is intentionally
narrower: the nonzero k6 exit must be paired with a terminal stopped/missing
state for an exact `auth-load` target. The workflow then writes `capacity.json`,
`soak.json`, and `summary.md` with an `INTERRUPTED/FAIL` verdict, the bounded k6
exit code, observed target status, container exit code/OOM flag when known, and
the phase-local evidence timestamps. It does not invent soak minute metrics or
a measurement epoch, and it does not claim that the probed VU level survived
the requested soak. Exit and OOM values are observations only, not causal
diagnoses. Missing summaries in every other condition still abort as harness
errors.

Smoke mode writes its deterministic k6 smoke summary only. It verifies coverage
of login/token exchange, introspection, UserInfo, refresh, discovery, JWKS, and
revoke/relogin; it does not write or claim `capacity.json`, `soak.json`, a
maximum VU count, or an endurance result.

Results are specific to the local host, Docker resource allocation, image, and
run conditions. k6 competes with the measured containers for the same hardware,
so load-generator contention can lower the observed service capacity. Record
those conditions when comparing runs or machines.

Runtime passwords, cookie keys, client secrets, authorization codes, PKCE
verifiers, cookies, and tokens are generated for the run and are never retained
in reports. The temporary `load-tests/.runtime.env` is permission-restricted and
removed during cleanup and error handling. Do not copy it, logs, or raw protocol
responses into results or bug reports.
