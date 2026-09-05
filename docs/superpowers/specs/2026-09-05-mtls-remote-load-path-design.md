# mTLS Remote Load Path Design

Date: 2026-09-05

## Goal

Run protocol-correct k6 OIDC traffic from the M1 Mini directly to the Auth PC
without an SSH tunnel, while keeping the Auth application port private and
requiring a dedicated client certificate for every request.

The fixed machine roles and addresses are:

- M1 Mini load generator: observed LAN source `192.168.0.17`.
- Auth PC target: LAN address `192.168.0.18`.
- Test-only public endpoint: `https://auth-service:13443` mapped by the M1
  Docker run command to `192.168.0.18`.

No router port forwarding or public Internet exposure is part of this design.

## Architecture

A separate Compose overlay adds an Nginx mTLS gateway to the existing
`auth-load` project. The gateway publishes only port `13443` on the explicitly
configured Auth PC LAN address. It forwards accepted requests over the private
Compose network to `http://auth-service:3000`. The existing loopback mapping
`127.0.0.1:13000` remains available for target-side health checks and the Auth
application port is never rebound to a LAN wildcard.

The Auth service issuer and the M1 k6 `BASE_URL` are both exactly
`https://auth-service:13443`. The server certificate has DNS SAN
`auth-service` and IP SAN `192.168.0.18`. The M1 Docker invocation uses an
explicit host mapping for `auth-service:192.168.0.18`, so issuer, redirect
validation, TLS hostname validation, and the network destination agree.

The gateway is the only new network boundary. `service/` and `ui/` application
code remain unchanged.

## PKI and secret lifecycle

An Auth-PC setup script creates a test-only CA, one server certificate, and one
M1 client certificate with OpenSSL. All generated files live beneath the
gitignored `load-tests/.remote-tls/` directory. Directories use mode `0700` and
private keys use mode `0600`.

The server private key and CA private key never leave the Auth PC. Only these
three generator files are copied to the M1 over the already verified SSH
connection:

- CA public certificate;
- M1 client certificate;
- M1 client private key.

The M1 keeps them beneath its gitignored checkout path with the same restrictive
permissions. Runtime Auth credentials remain in the existing mode-`0600`
`.remote-k6.env` file and are never printed by the scripts.

The client certificate has the extended key usage `clientAuth`; the server
certificate has `serverAuth`. The gateway validates the client chain against
the dedicated CA and rejects missing, untrusted, expired, or wrong-purpose
certificates. Certificate verification cannot be disabled by a runner option.

## Gateway behavior

The gateway:

- listens on TLS 1.2 or TLS 1.3 at port `13443`;
- requires a verified client certificate before proxying;
- uses the dedicated test server certificate and key;
- forwards `Host`, `X-Forwarded-Proto`, `X-Forwarded-Host`, and
  `X-Forwarded-Port` consistently with the external issuer;
- uses bounded proxy connection, send, and read timeouts;
- does not log authorization headers, cookies, request bodies, query strings,
  certificates, or keys; and
- emits only minimal status and timing access data required to diagnose the
  load path.

Client-certificate authentication is authoritative. The listener is also bound
to the exact LAN address instead of `0.0.0.0`. An IP allowlist is not used
inside the container because Colima/Docker NAT can replace the original client
source address; relying on that translated address would create a brittle or
false security boundary.

## Remote runner

The M1 runner is a Bash 3.2-compatible script with explicit subcommands:

- `verify`: prove server trust and mTLS using one health request, then run the
  deterministic OIDC smoke;
- `probe`: run the configured VU count with a 60-second warm-up and 180-second
  measurement by default;
- `soak`: run the configured VU count for exactly 1,800 seconds by default.

The runner validates that:

- it is executing from the expected Git checkout;
- the Docker daemon and pinned `grafana/k6:2.2.0` image are available;
- the target is exactly `https://auth-service:13443`;
- the destination mapping is a private IPv4 address and defaults to
  `192.168.0.18`;
- the secret environment and client private-key files are not group- or
  world-readable;
- the CA, client certificate, and client key form the expected files; and
- the result path stays beneath `load-tests/results/remote/`.

The k6 scripts enable `tlsAuth` only when the explicit remote-mTLS mode is
selected. They load the certificate and key from fixed read-only container
paths and scope them to `auth-service`. The runner mounts the CA public
certificate as the container trust bundle and never enables
`insecureSkipTLSVerify`.

## Test sequence and artifacts

The safe sequence is:

1. Start the target stack plus the mTLS overlay on the Auth PC.
2. Confirm that a request without a client certificate is rejected.
3. Confirm that a request with the generated M1 certificate returns healthy.
4. Copy the three generator certificate files to the M1.
5. Run `verify`, which includes deterministic OIDC smoke.
6. Run a 300-VU probe before the endurance test.
7. If the probe satisfies the existing thresholds, run 300 VUs for 30 minutes.

Each M1 run writes a timestamped k6 JSON summary under
`load-tests/results/remote/`. The Auth PC monitor is started separately before
the probe or soak and writes target CPU, memory, restart, and health samples.
An Auth-PC-only foreground campaign command persists both CSV and structured
monitor samples beneath `load-tests/results/remote/<campaign-id>/`. It prints
the generated campaign ID only after the first target sample succeeds and
finishes with a forced terminal sample on `SIGINT` or `SIGTERM`.

After the M1 summary is copied into that exact campaign directory, a report
command validates the declared kind, VUs, timings, filenames, file ownership,
permissions, completion marker, and measurement coverage. It uses the k6
measurement epoch—not the filename or copy time—to exclude probe warm-up and
to correlate soak minute buckets with target samples. Missing coverage, clock
skew, malformed inputs, or monitor gaps produce `INCONCLUSIVE`, never an
assumed passing state.

The remote renderer produces a dedicated Markdown report and fixed-label,
numeric-only SVG charts. A probe report includes endpoint latency and target
resource timelines; a soak report additionally includes per-minute RPS and
latency. Network counters are labelled as cumulative container I/O. A single
imported summary is described only as a single remote probe or soak
observation: it cannot establish a capacity limit, prove a prior passing probe,
or reproduce the local security-gate evidence. A failed mTLS or OIDC
verification is a harness failure, not a capacity result.

## Failure and cleanup behavior

Every script fails closed on an unsafe path, malformed address, permissive key
mode, missing certificate, failed certificate verification, target mismatch, or
Docker failure. It does not use `eval`, print environment contents, weaken TLS,
or recursively delete an unresolved path.

The gateway can be stopped independently with the remote-load Compose overlay.
The client bundle on the M1 is removed by an explicit cleanup command after the
test campaign. PKI removal on the Auth PC is also explicit so operators cannot
accidentally destroy keys needed to reproduce a still-running test.

## Tests

Automated tests cover:

1. Compose overlay rendering, exact LAN bind, private upstream, issuer, and
   read-only certificate mounts.
2. PKI setup argument/path validation, generated permissions, certificate
   purposes/SANs, and secret-free logs using an isolated temporary directory.
3. Remote runner command construction, strict target/address validation,
   permission checks, timestamped result confinement, and absence of TLS bypass
   flags.
4. k6 configuration behavior: remote mode requires HTTPS, the fixed host and
   certificate paths, while local mode remains unchanged.
5. A live mTLS integration check: no certificate and an untrusted certificate
   are rejected; the generated M1 certificate succeeds.
6. Foreground monitor lifecycle, structured sample persistence, signal-driven
   checkpoint/stop behavior, and exclusive safe campaign paths.
7. Imported-summary validation, warm-up exclusion, soak epoch/minute
   correlation, incomplete coverage classification, safe Markdown, and SVG
   chart rendering.
8. The existing complete load-test unit suite, shell syntax, formatting,
   Compose configuration, and diff hygiene.
