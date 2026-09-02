# Local k6 capacity test

This harness measures one locally containerized `auth-service` instance with
protocol-correct OIDC traffic. It builds the existing production service image
from `deploy/docker/Dockerfile.service` and creates dedicated PostgreSQL, Redis,
network, and volume data under the literal Compose project `auth-load`. It does
not use or modify the normal development stack or its data.

## Prerequisites

- Node.js 24 or newer and the repository's Yarn 4 installation
- Docker Desktop, or Docker Engine with Docker Compose v2
- Enough free CPU, memory, and disk space to build the service and run the
  service, PostgreSQL, Redis, and k6 containers concurrently

Run commands from the repository root. No separately running service is
required.

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
- `auth-service` restarts are zero; and
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

## Results and interpretation

Generated artifacts are written beneath the gitignored
`load-tests/results/<timestamp>/` directory. A full capacity run produces:

- `summary.md`: the human-readable conclusion, SLO table, endpoint observations,
  search bracket, soak outcome, and evidence for likely bottlenecks;
- `capacity.json`: each coarse and refinement probe, its SLO evaluation, the last
  passing VU level, and the first failing VU level;
- `soak.json`: bounded soak windows, their evaluations, and the first violation
  minute when one exists;
- `docker-stats.csv`: time-series CPU, memory, network, container state,
  restart-count, and dependency samples; and
- `environment.json` plus per-phase k6 summaries: allowlisted run context and
  machine-readable observations used to construct the report.

Start with `summary.md`, confirm the search bracket in `capacity.json`, inspect
the time and failure window in `soak.json`, then correlate it with resource and
restart samples in `docker-stats.csv`. Treat a reported maximum as the maximum
**observed** passing level within this run and search bracket. If every probe up
to `MAX_VUS` passes, the result is only “at least N VUs” at the configured search
cap, not proof that N is the service's absolute maximum.

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
