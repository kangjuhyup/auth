# M1 Remote Load Generator Bootstrap Design

Date: 2026-09-05

## Goal

Provide one standalone Bash script that can be downloaded onto the M1 Mini and executed there. The script clones or safely updates this repository and prepares a pinned, Docker-based k6 load-generator environment.

The machine roles are fixed:

- M1 Mini: k6 load generation only.
- Current PC: `auth-service`, PostgreSQL, Redis, and target-side monitoring.

The M1 Mini can reach the Auth PC at `192.168.0.18`; SSH port 22 connectivity has been verified. The setup script does not assume that the Auth HTTP endpoint is exposed yet.

## Delivery and invocation

The repository will contain `scripts/setup-remote-loadgen.sh`. After that file is available on a GitHub branch, the operator downloads it as a file, inspects or verifies it, and then runs it:

```bash
curl --proto '=https' --tlsv1.2 --fail --location \
  --output setup-remote-loadgen.sh \
  https://raw.githubusercontent.com/kangjuhyup/auth/main/scripts/setup-remote-loadgen.sh
chmod 700 setup-remote-loadgen.sh
./setup-remote-loadgen.sh --branch main --directory "$PWD/auth-loadgen"
```

The design intentionally does not recommend piping a remote script directly into a shell.

## Script interface

Supported options:

- `--repo URL`: repository URL; defaults to `https://github.com/kangjuhyup/auth.git`.
- `--branch NAME`: branch to clone or update; defaults to `main`.
- `--directory PATH`: destination checkout; required so the script never guesses a destructive target.
- `--help`: print usage without changing state.

Unknown options, missing values, an empty directory, `/`, and the current user's home directory are rejected.

## Bootstrap behavior

The script performs these operations in order:

1. Require macOS on Apple Silicon (`Darwin` and `arm64`).
2. Require `git`, `docker`, and Docker Compose plugin v2 or newer.
3. Require the Docker daemon to be running.
4. Clone the selected branch when the destination does not exist.
5. When the destination already exists:
   - require it to be a Git checkout;
   - require its `origin` to match `--repo`;
   - refuse a dirty worktree;
   - fetch the requested branch and update only with a fast-forward merge.
6. Verify the checkout contains the expected load-test scripts.
7. Pull the exact `grafana/k6:2.2.0` image.
8. Require the pulled image architecture to be `arm64`.
9. Execute `k6 version` inside a disposable container.
10. Create a mode-`0700` result directory under the existing Git-ignored `load-tests/results/remote` path.
11. Print a sanitized readiness summary and the next-step boundary.

The script is idempotent for a clean checkout already on the requested branch.

## Security boundaries

This bootstrap script does not:

- open or rebind an Auth service port;
- enable `ALLOW_REMOTE_TARGET` or weaken the local-target guard;
- transfer, request, print, or store runtime passwords, tokens, cookies, client secrets, or PKCE material;
- execute capacity traffic;
- install Homebrew, Docker Desktop, Git, or privileged system services;
- reset, clean, or overwrite a dirty repository;
- use a public IP as an Auth target.

The later remote-execution feature must use an explicitly allowlisted target, production-equivalent TLS for OIDC traffic, ephemeral secret delivery, separate generator/target metrics, and target-side monitoring. That feature is out of scope for this bootstrap.

## Failure behavior

Every validation fails closed with a short phase-specific error. Commands are executed with quoted argument arrays; repository URL, branch, and path values are never evaluated as shell source. Partial clone directories are not recursively deleted automatically. Existing user data is never removed.

If Git fetch or fast-forward update fails, the checkout is preserved for manual inspection. If Docker or k6 validation fails, the cloned repository remains intact and no runtime secret file exists.

## Tests

Node's built-in test runner will execute the real shell script against a temporary local Git remote while replacing only external platform boundaries such as Docker and `uname`.

Required cases:

1. A fresh destination clones the requested branch and validates the pinned arm64 k6 image.
2. A clean existing checkout updates by fast-forward and remains idempotent.
3. A dirty checkout is rejected without changing its branch or files.
4. A mismatched remote, unsupported OS/architecture, stopped Docker daemon, or non-arm64 image is rejected.
5. Unsafe destination paths and malformed arguments are rejected.
6. Logs and generated files contain no runtime secret material.

Verification also includes Shell syntax checking, ESLint for the Node test, Prettier for documentation, and the existing load-test unit suite.

## Documentation

`load-tests/README.md` will gain an M1 bootstrap section containing the download command, option reference, successful output expectations, rerun behavior, and the explicit statement that remote traffic is not enabled by this setup step.
