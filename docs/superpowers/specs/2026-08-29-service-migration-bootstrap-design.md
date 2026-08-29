# Service Migration and Bootstrap Design

## Goal

Package the authorization server image so a production container can run compiled MikroORM migrations without Yarn, TypeScript, `ts-node`, or the MikroORM CLI. Preserve every deployed migration file, keep the legacy administrator environment variables for fresh-database migration compatibility, and add explicit idempotent bootstrap commands for the administrator and local `acme` / `e-vote` data.

## Scope

This change affects only `service/`, the service Docker image, and service deployment documentation/configuration. It does not couple `ui/` to `service/`, alter node-oidc-provider protocol behavior, rewrite migration history, or replace Yarn 4 with pnpm.

The accepted compatibility rule is:

- Existing migration files remain byte-for-byte unchanged.
- A fresh database still requires `ADMIN_USERNAME` and `ADMIN_PASSWORD` while `Migration20260404000001` is pending.
- New environment-specific data is created through separate bootstrap commands rather than future schema migrations.

## Current Failure and Root Cause

The current production image builds successfully but cannot invoke its migration scripts:

- `yarn` resolves to Yarn 1.22.22 and rejects the root `packageManager: yarn@4.12.0` declaration.
- `corepack yarn` resolves Yarn 4.12.0 but fails because the runner image does not contain the complete root workspace and lockfile context.
- Direct execution of the MikroORM CLI fails because production dependency focusing removes `typescript`, which `ts-node` requires to load `mikro-orm.config.ts`.
- Compiled migration JavaScript is already present under `service/dist/infrastructure/mikro-orm/migrations`, but no compiled Node entry point invokes it.
- The current optional startup runner is called only after Nest application initialization, coupling schema readiness to full application startup.

The root fix is therefore a compiled Node migration entry point and a Docker entrypoint that invokes Node directly. Reconstructing a development Yarn workspace inside the runner image would retain unnecessary runtime tooling and is not part of the design.

## Runtime Commands

The service package will expose these commands:

```json
{
  "migration:up:prod": "node dist/cli/migrate.js",
  "bootstrap:admin:prod": "node dist/cli/bootstrap-admin.js",
  "bootstrap:vote:prod": "node dist/cli/bootstrap-vote.js"
}
```

These package scripts are operator conveniences outside the container. Docker startup does not execute Yarn; it invokes the compiled JavaScript files directly.

The existing development-only MikroORM CLI scripts remain available during development. `@mikro-orm/cli` and `ts-node` move to `devDependencies`; `@mikro-orm/core`, `@mikro-orm/migrations`, the configured database drivers, `argon2`, `ulid`, and every dependency used by compiled migrations remain production dependencies.

## Compiled Migration Runner

`service/src/cli/migrate.ts` will:

1. Build configuration through the existing `buildMikroOrmConfig` function and `process.env`.
2. Initialize `MikroORM` with the `Migrator` extension.
3. Execute `orm.getMigrator().up()` against compiled migrations selected by `DB_DRIVER`.
4. Close the ORM in a `finally` block.
5. Set a non-zero process exit code on failure.

The runner logs only fixed status messages. It does not print the configuration object, connection URL, database password, error stack, or raw exception message. This keeps credential-bearing driver errors out of startup logs. Unit tests exercise the callable runner with an injected ORM initializer; the executable wrapper stays thin.

The migration paths remain relative to `/app/service`:

```text
dist/infrastructure/mikro-orm/migrations/<driver>/**/*.js
```

No TypeScript migration/config file is copied into the production image.

## Docker Startup and Packaging

The build stage continues to use Corepack and Yarn 4 with the complete root workspace manifests before `yarn install --immutable`. Yarn is a build tool only.

After compilation and `yarn workspaces focus @auth/service --production`, the runner stage contains:

- `service/dist`, including `dist/cli/migrate.js` and compiled migrations;
- focused production `node_modules`;
- the service package manifest;
- a small POSIX entrypoint script.

The entrypoint performs:

```text
node dist/cli/migrate.js
  -> success: exec the container command (default: node dist/main.js)
  -> failure: exit non-zero and never start the HTTP server
```

Using `exec` ensures the Node service receives termination signals directly. Bootstrap commands are not run automatically, because environment data creation should be an explicit deployment/operator action. Overriding the container command with a bootstrap executable still runs migration first, which guarantees schema readiness.

The old Nest-coupled `DB_MIGRATIONS_RUN_ON_STARTUP` path and configuration are removed to avoid two migration mechanisms. Non-container execution uses `migration:up:prod` explicitly before `start:prod`.

## Bootstrap Architecture

Bootstrap writes must not bypass the application layer. The compiled CLI wrappers create a Nest application context, establish a MikroORM request context, resolve bootstrap application ports, execute the requested process, and close the context in `finally`.

Because administrator and vote setup span multiple aggregates, each is implemented as an application process manager. Process progress is persisted through an application port and a MikroORM adapter in a `bootstrap_process` table. A new forward-only schema migration creates this table for PostgreSQL, MySQL, and MSSQL; no existing migration is edited.

Each record contains a unique process key, current step, status, retry count, last non-sensitive failure code, and timestamps. The unique process key prevents duplicate concurrent bootstrap runs. Steps are monotonic and independently idempotent, so partial success is resumed without compensating deletion. Bootstrap never treats a projection or Redis value as authoritative; it checks write-side repositories.

### Administrator bootstrap

`bootstrap:admin:prod` reads `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_UI_URL`. Username and password are required only when the process must create a missing administrator. Neither value is logged.

The process manager ensures, through existing command handlers, that the following exist:

1. `master` tenant and its built-in scopes;
2. `SUPER_ADMIN` role;
3. configured administrator user with a password credential;
4. administrator-to-role assignment;
5. `__admin-portal__` client.

Existing users, credentials, roles, assignments, and client metadata are not overwritten. In particular, rerunning bootstrap never rotates or resets the administrator password. A newly created administrator receives a temporary password that must be changed according to the existing application policy.

On a fresh database, the preserved legacy migration creates these records first, so the administrator bootstrap is normally a no-op. The separate command supports future deployments and repair of an already-migrated schema without adding more environment data to schema migrations.

### Vote bootstrap

`bootstrap:vote:prod` ensures this desired local setup:

```text
tenant code: acme
tenant name: Acme
client_id: e-vote
client name: e-vote
type: public
token_endpoint_auth_method: none
redirect_uri: http://localhost:3001/api/auth/callback/e-vote
grant_types: authorization_code, refresh_token
response_types: code
scope: openid profile email
application_type: web
```

The localhost HTTP redirect is accepted only for this local bootstrap profile. node-oidc-provider remains responsible for runtime redirect URI and PKCE validation; the bootstrap does not reimplement protocol checks. Public-client PKCE remains S256-only through existing provider configuration.

If `acme` or `e-vote` already exists, the process verifies tenant binding and exits without changing the existing record. It does not silently reconcile or overwrite redirect URIs, grants, scopes, client type, or authentication method. A conflicting cross-tenant or incompatible existing client produces a non-zero exit and a sanitized reason so an operator must resolve the conflict explicitly.

## Error Handling and Security

- Migration failure prevents service startup.
- Bootstrap failure returns a non-zero exit code and leaves completed idempotent steps intact for retry.
- Database passwords, URLs containing credentials, administrator passwords, client secrets, tokens, authorization codes, and raw exception objects are never logged.
- Allowed operational identifiers include process name, step, tenant code, and client ID.
- `e-vote` is public and has no client secret.
- Repository lookups bind `e-vote` to the resolved `acme` tenant ID; a client found under another tenant never satisfies the bootstrap.
- Existing client/admin configuration is never overwritten merely because the bootstrap is rerun.

## Tests

Implementation follows red-green-refactor and keeps Nest module loading out of unit tests.

Unit tests cover:

- compiled migration runner initializes with `Migrator`, calls `up`, closes on success/failure, and emits only sanitized failure output;
- administrator process resumes from every step, does not reset an existing password, and persists retry state without exposing secrets;
- vote process creates the tenant before the client, uses the exact approved metadata, is idempotent on rerun, and rejects tenant/client conflicts;
- process state persistence and concurrency protection;
- Docker entrypoint stops before service startup when migration exits non-zero and uses `exec` after success.

Repository/integration tests cover the bootstrap process state adapter with PostgreSQL. Existing command-handler tests remain the source of truth for aggregate invariants.

## Image Verification

Verification uses a new PostgreSQL 16 container and a freshly built service image:

1. Inspect the image to confirm Yarn is not needed and TypeScript sources/CLI tooling are absent from the runtime path.
2. Start the service container with database settings plus the legacy administrator variables.
3. Confirm startup migration exits successfully before the HTTP server listens.
4. Query PostgreSQL for the MikroORM migration table and expected schema.
5. Run `bootstrap:admin:prod` and `bootstrap:vote:prod` using the same image.
6. Query write tables for `master`, the administrator, `acme`, and the exact `e-vote` client metadata.
7. Run both bootstrap commands again and confirm row counts and stored values do not change.
8. Restart the service container and confirm migration is a no-op followed by normal startup.
9. Run focused unit/integration tests, the full service unit suite, the service build, and the architecture dependency check.

Temporary containers, networks, and volumes created for verification are removed after results are captured.

## Out of Scope

- Editing or squashing deployed migrations;
- making a fresh database migrate without the legacy administrator variables;
- migrating the monorepo from Yarn to pnpm;
- automatically running environment bootstrap on every service replica;
- changing OIDC endpoints, token issuance, grant validation, PKCE implementation, or redirect validation;
- automatically overwriting drifted administrator or client data.
