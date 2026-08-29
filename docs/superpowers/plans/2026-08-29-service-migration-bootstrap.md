# Service Migration and Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an authorization-server image that runs compiled migrations before HTTP startup and exposes idempotent compiled administrator and `acme` tenant bootstrap commands.

**Architecture:** A thin Node CLI initializes MikroORM with `Migrator`, while a POSIX Docker entrypoint runs that CLI and then `exec`s the service. Administrator and `acme` setup use application process managers, existing aggregate command ports, write-side repositories, and a locked MikroORM-backed process-state port so retries and concurrent invocations are idempotent.

**Tech Stack:** Node.js 24, TypeScript, NestJS 11, MikroORM 6.6.12, PostgreSQL/MySQL/MSSQL migrations, Yarn 4.12.0, Jest 29, Docker/Alpine.

**Spec:** `docs/superpowers/specs/2026-08-29-service-migration-bootstrap-design.md`

## Global Constraints

- Preserve every existing migration file; only add `Migration20260829000000` for process state.
- A fresh database continues to require `ADMIN_USERNAME` and `ADMIN_PASSWORD` while `Migration20260404000001` is pending.
- Keep Yarn 4 as a build-time tool; production startup and bootstrap execute compiled JavaScript with `node`.
- Main and release publication must push a multi-platform manifest containing both `linux/amd64` and `linux/arm64`.
- Do not copy `mikro-orm.config.ts`, TypeScript migrations, `typescript`, `ts-node`, or `@mikro-orm/cli` into the runtime dependency set.
- Preserve dependency direction: `presentation → application → domain` and `infrastructure → application → domain`.
- Bootstrap writes go through application command ports. Write-side repositories may be read only to decide whether a command is needed.
- Do not use projections or Redis to decide bootstrap invariants.
- Do not log database URLs, database passwords, administrator passwords, client secrets, tokens, raw exceptions, or exception stacks.
- The `acme` bootstrap creates only the tenant and its built-in scopes. It must not create an OIDC client or application.
- Unit tests do not load Nest modules. Use narrow fakes only for external or persistence boundaries.

---

## File Structure

- `service/src/cli/migrate.ts`: injectable compiled migration runner.
- `deploy/docker/service-entrypoint.sh`: fail-fast migration then signal-safe `exec`.
- `service/src/application/process-managers/`: pure process state, step runner, and admin/acme workflows.
- `service/src/application/process-managers/ports/`: application bootstrap and persistence ports.
- `service/src/infrastructure/mikro-orm/entities/bootstrap-process.ts`: persistence entity.
- `service/src/infrastructure/repositories/`: process-state and cross-tenant lookup adapters.
- `service/src/cli/bootstrap-runtime.ts` and `bootstrap-{admin,acme}.ts`: compiled operator commands.
- `service/test/cli`, `service/test/application/process-managers`, and `service/test/infrastructure/repositories`: TDD coverage.
- `deploy/docker/Dockerfile.service` and `service/package.json`: focused runtime packaging.
- `README.md`, `service/.env.example`, and deploy manifests: operator contract.

---

### Task 1: Compiled migration runner

**Files:**

- Create: `service/src/cli/migrate.ts`
- Create: `service/test/cli/migrate.spec.ts`
- Modify: `service/package.json`
- Modify: `service/src/main.ts`
- Delete: `service/src/infrastructure/mikro-orm/startup-migration-runner.ts`
- Delete: `service/test/infrastructure/mikro-orm/startup-migration-runner.spec.ts`

**Interfaces:**

- Consumes: `buildMikroOrmConfig`, `MikroORM.init`, and `Migrator`.
- Produces: `runMigrations(deps?): Promise<void>` and `runMigrationCli(deps?): Promise<number>`.

- [ ] **Step 1: Write the failing runner tests**

The production mutations caught are removing `Migrator`, skipping `up`, skipping `close(true)`, and logging a raw driver error.

```typescript
import { Migrator } from '@mikro-orm/migrations';
import { runMigrationCli, runMigrations } from '../../src/cli/migrate';

describe('compiled migration runner', () => {
  it('initializes Migrator, applies migrations, and closes the ORM', async () => {
    const up = jest.fn().mockResolvedValue(undefined);
    const close = jest.fn().mockResolvedValue(undefined);
    const init = jest.fn().mockResolvedValue({
      getMigrator: () => ({ up }),
      close,
    });

    await runMigrations({
      readConfig: (key) => (key === 'DB_NAME' ? 'auth_test' : undefined),
      init,
    });

    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({
        dbName: 'auth_test',
        extensions: [Migrator],
      }),
    );
    expect(up).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledWith(true);
  });

  it('closes the ORM after migration failure', async () => {
    const close = jest.fn().mockResolvedValue(undefined);
    const init = jest.fn().mockResolvedValue({
      getMigrator: () => ({
        up: jest.fn().mockRejectedValue(new Error('driver failure')),
      }),
      close,
    });

    await expect(
      runMigrations({ readConfig: () => undefined, init }),
    ).rejects.toThrow('driver failure');
    expect(close).toHaveBeenCalledWith(true);
  });

  it('returns one without logging connection details', async () => {
    const error = jest.fn();
    const code = await runMigrationCli({
      run: jest
        .fn()
        .mockRejectedValue(
          new Error('postgresql://admin:secret@database.internal/auth'),
        ),
      error,
    });

    expect(code).toBe(1);
    expect(error).toHaveBeenCalledWith('Database migration failed');
    expect(JSON.stringify(error.mock.calls)).not.toContain('secret');
    expect(JSON.stringify(error.mock.calls)).not.toContain('database.internal');
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
yarn workspace @auth/service test --runInBand --watchman=false test/cli/migrate.spec.ts
```

Expected: FAIL because `src/cli/migrate.ts` does not exist.

- [ ] **Step 3: Implement the minimal runner**

Use these public shapes and fixed-message CLI behavior:

```typescript
import { MikroORM, type Options } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import { buildMikroOrmConfig } from '../infrastructure/mikro-orm/config/mikro-orm.config';

type MigrationOrm = {
  getMigrator(): { up(): Promise<unknown> };
  close(force?: boolean): Promise<void>;
};

export type MigrationDependencies = {
  readConfig(key: string): string | undefined;
  init(options: Options): Promise<MigrationOrm>;
};

export async function runMigrations(
  deps: MigrationDependencies = {
    readConfig: (key) => process.env[key],
    init: (options) => MikroORM.init(options),
  },
): Promise<void> {
  const config = buildMikroOrmConfig({ get: deps.readConfig });
  const orm = await deps.init({ ...config, extensions: [Migrator] });
  try {
    await orm.getMigrator().up();
  } finally {
    await orm.close(true);
  }
}
```

`runMigrationCli` catches without binding the raw exception, writes only `Database migration failed`, and returns `1`. The main-module guard assigns that result to `process.exitCode`.

Add `"migration:up:prod": "node dist/cli/migrate.js"` to `service/package.json`. Remove the old migration import/call from `main.ts`, then delete the old runner and test.

- [ ] **Step 4: Verify GREEN and compilation**

```bash
yarn workspace @auth/service test --runInBand --watchman=false test/cli/migrate.spec.ts
yarn workspace @auth/service build
test -f service/dist/cli/migrate.js
```

Expected: PASS, zero TypeScript issues, and a compiled runner.

- [ ] **Step 5: Commit**

```bash
git add service/src/cli/migrate.ts service/test/cli/migrate.spec.ts service/package.json service/src/main.ts service/src/infrastructure/mikro-orm/startup-migration-runner.ts service/test/infrastructure/mikro-orm/startup-migration-runner.spec.ts
git commit -m "feat(service): 컴파일 migration runner 추가"
```

---

### Task 2: Docker fail-fast entrypoint and runtime focus

**Files:**

- Create: `deploy/docker/service-entrypoint.sh`
- Create: `service/test/cli/service-entrypoint.spec.ts`
- Create: `service/test/cli/container-workflows.spec.ts`
- Modify: `deploy/docker/Dockerfile.service`
- Modify: `.github/workflows/container-main.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `service/package.json`
- Modify: `yarn.lock`

**Interfaces:**

- Consumes: `node dist/cli/migrate.js` and default command `node dist/main.js`.
- Produces: a POSIX entrypoint that stops on migration failure and replaces itself with the service process.
- Produces: GHCR publication manifests containing both `linux/amd64` and `linux/arm64` for main and versioned releases.

- [ ] **Step 1: Write failing entrypoint behavior tests**

Use a temporary fake `node`. One case returns 17 from migration and asserts the service command was never recorded. A second case runs a long-lived shell with a TERM trap, sends SIGTERM to the entrypoint PID, and expects exit code 42. Replacing `exec` with a child shell must make the signal case fail.

```typescript
const result = spawnSync('sh', [entrypoint, 'node', 'dist/main.js'], {
  env: {
    ...process.env,
    PATH: fakePath,
    ENTRYPOINT_CALLS: callsPath,
    MIGRATION_EXIT_CODE: '17',
  },
  encoding: 'utf8',
});

expect(result.status).toBe(17);
expect(readFileSync(callsPath, 'utf8')).toBe('dist/cli/migrate.js\n');
```

The signal-test command is:

```typescript
[entrypoint, 'sh', '-c', 'trap "exit 42" TERM; while :; do sleep 1; done'];
```

- [ ] **Step 2: Run the test and verify RED**

```bash
yarn workspace @auth/service test --runInBand --watchman=false test/cli/service-entrypoint.spec.ts
```

Expected: FAIL because `deploy/docker/service-entrypoint.sh` does not exist.

- [ ] **Step 3: Implement entrypoint and focus dependencies**

```sh
#!/bin/sh
set -eu

node dist/cli/migrate.js
exec "$@"
```

Move `@mikro-orm/cli` and `ts-node` from dependencies to devDependencies. Keep `@mikro-orm/core`, `@mikro-orm/migrations`, configured drivers, `argon2`, and `ulid` in dependencies.

Use an immutable focused builder install instead of installing every monorepo workspace twice:

```dockerfile
ENV YARN_NODE_LINKER=node-modules
ENV YARN_NETWORK_CONCURRENCY=4
ENV YARN_ENABLE_IMMUTABLE_INSTALLS=true
ENV HUSKY=0
RUN yarn workspaces focus auth @auth/service @auth/interaction-ui

COPY service service
RUN yarn workspace @auth/interaction-ui build
RUN yarn workspace @auth/service build
RUN yarn workspaces focus @auth/service --production
```

Copy only the root, service, and interaction-UI manifests before focus. Do not copy or install unrelated `ui`/`docs` workspaces, and do not repeat the same install after copying source.

Replace the runtime TypeScript copies with:

```dockerfile
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/service/package.json ./service/
COPY --from=build /repo/service/dist ./service/dist
COPY deploy/docker/service-entrypoint.sh /app/service-entrypoint.sh
RUN chmod 0755 /app/service-entrypoint.sh

USER node
WORKDIR /app/service
EXPOSE 3000
ENTRYPOINT ["/app/service-entrypoint.sh"]
CMD ["node", "dist/main.js"]
```

Set both publication workflows to:

```yaml
platforms: linux/amd64,linux/arm64
```

Keep QEMU and Buildx setup enabled. Update release comments/body so operators are not told the images are ARM-only. Add a narrow static workflow test that reads both YAML files and asserts the exact two-platform value, so dropping either architecture fails the suite.

- [ ] **Step 4: Verify tests and image contents**

```bash
yarn install --immutable
yarn workspace @auth/service test --runInBand --watchman=false test/cli/service-entrypoint.spec.ts test/cli/container-workflows.spec.ts
DOCKER_BUILDKIT=0 docker build -f deploy/docker/Dockerfile.service -t auth-service:entrypoint-check .
docker run --rm --entrypoint sh auth-service:entrypoint-check -lc 'test -f dist/cli/migrate.js && test ! -e mikro-orm.config.ts && test ! -d src && test ! -e /app/node_modules/typescript && test ! -e /app/node_modules/@mikro-orm/cli'
```

Expected: PASS and every runtime inspection exits zero.

- [ ] **Step 5: Commit**

```bash
git add deploy/docker/service-entrypoint.sh deploy/docker/Dockerfile.service .github/workflows/container-main.yml .github/workflows/release.yml service/test/cli/service-entrypoint.spec.ts service/test/cli/container-workflows.spec.ts service/package.json yarn.lock
git commit -m "feat(docker): 서비스 시작 전 migration 실행"
```

---

### Task 3: Persisted bootstrap process state

**Files:**

- Create: `service/src/application/process-managers/bootstrap-process-state.ts`
- Create: `service/src/application/process-managers/bootstrap-step-runner.ts`
- Create: `service/src/application/process-managers/ports/bootstrap-process.repository.ts`
- Create: `service/src/infrastructure/mikro-orm/entities/bootstrap-process.ts`
- Create: `service/src/infrastructure/repositories/bootstrap-process.repository.impl.ts`
- Create: `service/src/infrastructure/mikro-orm/migrations/{postgresql,mysql,mssql}/Migration20260829000000.ts`
- Create: `service/test/application/process-managers/bootstrap-step-runner.spec.ts`
- Create: `service/test/infrastructure/repositories/bootstrap-process.repository.impl.spec.ts`
- Modify: `service/src/infrastructure/mikro-orm/entities/index.ts`

**Interfaces:**

- Produces: `BootstrapProcessState`, `BootstrapFailureCode`, `BootstrapProcessRepository.withLockedState`, `BootstrapStepRunner.run`, and `BootstrapProcessError`.
- Consumes: forked EntityManager, `RequestContext`, transactions, and `LockMode.PESSIMISTIC_WRITE`.

- [ ] **Step 1: Write failing pure application tests**

Cover successful one-step advance, completed rerun no-op, and unexpected error retry state.

```typescript
const state = BootstrapProcessState.start('bootstrap:acme:v1', 'tenant');
const repository = {
  withLockedState: jest.fn(async (_params, work) => work(state)),
};
const runner = new BootstrapStepRunner(repository as never);

await runner.run({
  processKey: 'bootstrap:acme:v1',
  initialStep: 'tenant',
  expectedStep: 'tenant',
  nextStep: 'completed',
  work: jest.fn().mockResolvedValue(undefined),
});

expect(state.step).toBe('completed');
expect(state.status).toBe('pending');
```

Failure expectations:

```typescript
expect(state.retryCount).toBe(1);
expect(state.lastFailureCode).toBe('BOOTSTRAP_STEP_FAILED');
expect(JSON.stringify(state)).not.toContain('secret');
```

- [ ] **Step 2: Verify RED**

```bash
yarn workspace @auth/service test --runInBand --watchman=false test/application/process-managers/bootstrap-step-runner.spec.ts
```

Expected: FAIL because process-state files do not exist.

- [ ] **Step 3: Implement pure state and the port**

```typescript
export type BootstrapProcessStatus =
  | 'pending'
  | 'running'
  | 'failed'
  | 'completed';

export type BootstrapFailureCode =
  | 'ADMIN_CREDENTIALS_REQUIRED'
  | 'ADMIN_PORTAL_CONFLICT'
  | 'BOOTSTRAP_STEP_FAILED';

export abstract class BootstrapProcessRepository {
  abstract withLockedState<T>(
    params: { processKey: string; initialStep: string },
    work: (state: BootstrapProcessState) => Promise<T>,
  ): Promise<T>;
}
```

`BootstrapProcessState` has private construction, static `start`, static `rehydrate`, `beginAttempt`, `advance`, `fail`, and `complete`. `BootstrapStepRunner` catches the raw error inside the locked callback, stores only a supplied known code or `BOOTSTRAP_STEP_FAILED`, lets the adapter commit state, then throws `BootstrapProcessError` containing only the safe code.

- [ ] **Step 4: Add entity and migrations**

All drivers create `bootstrap_process` with `process_key VARCHAR(128)` primary key, `step VARCHAR(64)`, `status VARCHAR(16)`, `retry_count INT DEFAULT 0`, nullable `last_failure_code VARCHAR(64)`, `created_at`, and `updated_at`.

PostgreSQL:

```sql
CREATE TABLE IF NOT EXISTS "bootstrap_process" (
  "process_key" VARCHAR(128) NOT NULL PRIMARY KEY,
  "step" VARCHAR(64) NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "retry_count" INT NOT NULL DEFAULT 0,
  "last_failure_code" VARCHAR(64) NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

MySQL:

```sql
CREATE TABLE IF NOT EXISTS `bootstrap_process` (
  `process_key` VARCHAR(128) NOT NULL PRIMARY KEY,
  `step` VARCHAR(64) NOT NULL,
  `status` VARCHAR(16) NOT NULL,
  `retry_count` INT NOT NULL DEFAULT 0,
  `last_failure_code` VARCHAR(64) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

MSSQL:

```sql
IF OBJECT_ID(N'dbo.[bootstrap_process]', N'U') IS NULL
CREATE TABLE [bootstrap_process] (
  [process_key] NVARCHAR(128) NOT NULL PRIMARY KEY,
  [step] NVARCHAR(64) NOT NULL,
  [status] NVARCHAR(16) NOT NULL,
  [retry_count] INT NOT NULL DEFAULT 0,
  [last_failure_code] NVARCHAR(64) NULL,
  [created_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [updated_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
```

Each down method drops only this table using guarded driver syntax.

- [ ] **Step 5: Write failing adapter tests**

The concurrency mutation must fail:

```typescript
expect(entityManager.findOne).toHaveBeenCalledWith(
  BootstrapProcessOrmEntity,
  { processKey: 'bootstrap:acme:v1' },
  { lockMode: LockMode.PESSIMISTIC_WRITE },
);
expect(entity.step).toBe('completed');
expect(entityManager.flush).toHaveBeenCalledTimes(1);
```

Also cover absent-row insert and a unique-constraint race that retries the locked lookup without running two callbacks.

- [ ] **Step 6: Implement adapter and verify GREEN**

`BootstrapProcessRepositoryImpl` uses `orm.em.fork()`, `RequestContext.create`, `em.transactional`, and `LockMode.PESSIMISTIC_WRITE`. It maps only process-state fields and never persists exception text.

```bash
yarn workspace @auth/service test --runInBand --watchman=false test/application/process-managers/bootstrap-step-runner.spec.ts test/infrastructure/repositories/bootstrap-process.repository.impl.spec.ts
yarn workspace @auth/service build
test -f service/dist/infrastructure/mikro-orm/migrations/postgresql/Migration20260829000000.js
test -f service/dist/infrastructure/mikro-orm/migrations/mysql/Migration20260829000000.js
test -f service/dist/infrastructure/mikro-orm/migrations/mssql/Migration20260829000000.js
```

- [ ] **Step 7: Commit**

```bash
git add service/src/application/process-managers service/src/infrastructure/mikro-orm/entities service/src/infrastructure/repositories/bootstrap-process.repository.impl.ts service/src/infrastructure/mikro-orm/migrations service/test/application/process-managers service/test/infrastructure/repositories/bootstrap-process.repository.impl.spec.ts
git commit -m "feat(service): bootstrap process 상태 저장"
```

---

### Task 4: Idempotent `acme` tenant workflow

**Files:**

- Create: `service/src/application/process-managers/ports/acme-bootstrap.port.ts`
- Create: `service/src/application/process-managers/acme-bootstrap.process-manager.ts`
- Create: `service/test/application/process-managers/acme-bootstrap.process-manager.spec.ts`

**Interfaces:**

- Consumes: `BootstrapStepRunner`, the tenant command port, and `TenantRepository`.
- Produces: `AcmeBootstrapPort.bootstrap(): Promise<void>`.

- [ ] **Step 1: Write failing workflow tests**

Exact desired tenant:

```typescript
CreateTenantDto.of({ code: 'acme', name: 'Acme' });
```

Add independent cases proving a missing tenant creates `acme` through the tenant command port, an existing tenant causes no write or rename, and completed state makes rerun a no-op. Assert no client/application port is part of the workflow.

- [ ] **Step 2: Verify RED**

```bash
yarn workspace @auth/service test --runInBand --watchman=false test/application/process-managers/acme-bootstrap.process-manager.spec.ts
```

Expected: FAIL because workflow files do not exist.

- [ ] **Step 3: Implement workflow**

Use process key `bootstrap:acme:v1` and steps `tenant → completed`. Only a missing `acme` invokes `createTenant`. Existing tenant data is never overwritten. The existing tenant command path remains responsible for built-in scopes.

- [ ] **Step 4: Verify GREEN and commit**

```bash
yarn workspace @auth/service test --runInBand --watchman=false test/application/process-managers/acme-bootstrap.process-manager.spec.ts
yarn workspace @auth/service build
git add service/src/application/process-managers/ports/acme-bootstrap.port.ts service/src/application/process-managers/acme-bootstrap.process-manager.ts service/test/application/process-managers/acme-bootstrap.process-manager.spec.ts
git commit -m "feat(service): acme tenant bootstrap process 추가"
```

---

### Task 5: Idempotent administrator workflow

**Files:**

- Create: `service/src/application/process-managers/ports/admin-bootstrap.port.ts`
- Create: `service/src/application/process-managers/admin-bootstrap.process-manager.ts`
- Create: `service/test/application/process-managers/admin-bootstrap.process-manager.spec.ts`

**Interfaces:**

- Consumes: step runner, tenant/user/role/client command ports, `TenantRepository`, `UserWriteRepositoryPort`, `RoleRepository`, `RoleAssignmentRepository`, and `ClientRepository`.
- Produces: `AdminBootstrapPort.bootstrap(input: AdminBootstrapInput): Promise<void>`.

- [ ] **Step 1: Write failing administrator tests**

Use steps `tenant → role → user → role-assignment → client → completed`. Cover missing master; missing `SUPER_ADMIN`; missing user without password; missing user with `temporaryPassword: true`; existing user without password reset; missing/existing role assignment; missing/incompatible portal client; completed rerun without password persistence/logging.

Exact portal client:

```typescript
CreateClientDto.of({
  clientId: '__admin-portal__',
  name: 'Admin Portal',
  type: 'confidential',
  redirectUris: ['http://localhost:5173/admin/tenants'],
  grantTypes: ['authorization_code'],
  responseTypes: ['code'],
  tokenEndpointAuthMethod: 'none',
  scope: 'openid profile',
  postLogoutRedirectUris: ['http://localhost:5173/login'],
  applicationType: 'web',
  skipConsent: true,
});
```

- [ ] **Step 2: Verify RED**

```bash
yarn workspace @auth/service test --runInBand --watchman=false test/application/process-managers/admin-bootstrap.process-manager.spec.ts
```

Expected: FAIL because administrator workflow files do not exist.

- [ ] **Step 3: Implement workflow**

Use process key `bootstrap:admin:v1`. Reload identifiers from write-side repositories after each preceding command. Use `AuditContext.of` with correlation ID `bootstrap:admin:v1` and no unauthenticated user ID. Missing credentials and portal conflict use safe known codes; every unexpected error becomes `BOOTSTRAP_STEP_FAILED`.

- [ ] **Step 4: Verify GREEN and commit**

```bash
yarn workspace @auth/service test --runInBand --watchman=false test/application/process-managers/admin-bootstrap.process-manager.spec.ts test/application/process-managers/bootstrap-step-runner.spec.ts
yarn workspace @auth/service build
git add service/src/application/process-managers/ports/admin-bootstrap.port.ts service/src/application/process-managers/admin-bootstrap.process-manager.ts service/test/application/process-managers/admin-bootstrap.process-manager.spec.ts
git commit -m "feat(service): 관리자 bootstrap process 추가"
```

---

### Task 6: Compiled bootstrap CLI and Nest wiring

**Files:**

- Create: `service/src/cli/bootstrap-runtime.ts`
- Create: `service/src/cli/bootstrap-admin.ts`
- Create: `service/src/cli/bootstrap-acme.ts`
- Create: `service/test/cli/bootstrap-runtime.spec.ts`
- Modify: `service/src/application/application.module.ts`
- Modify: `service/src/infrastructure/infrastructure.module.ts`
- Modify: `service/package.json`

**Interfaces:**

- Consumes: `AppModule`, `MikroORM`, `AdminBootstrapPort`, `AcmeBootstrapPort`, and Tasks 3-5 providers.
- Produces: `runBootstrapCommand` and compiled admin/acme executables.

- [ ] **Step 1: Write failing runtime tests**

Prove work runs in a request context, Nest closes on success/failure, and raw errors become fixed text.

```typescript
const code = await runBootstrapCommand({
  createContext,
  requestContext,
  execute: work,
  failureMessage: 'Acme bootstrap failed',
  error,
});

expect(code).toBe(0);
expect(work).toHaveBeenCalledTimes(1);
expect(close).toHaveBeenCalledTimes(1);
```

The failure exception includes `password=secret` and `database.internal`; neither may appear in logger calls.

- [ ] **Step 2: Verify RED**

```bash
yarn workspace @auth/service test --runInBand --watchman=false test/cli/bootstrap-runtime.spec.ts
```

Expected: FAIL because runtime file does not exist.

- [ ] **Step 3: Implement runtime and wrappers**

`runBootstrapCommand` accepts `execute(appContext): Promise<void>`, creates an application context from `AppModule`, obtains `MikroORM`, calls `RequestContext.create(orm.em, () => execute(appContext))`, closes in `finally`, and returns zero/one. The wrappers resolve `AdminBootstrapPort` or `AcmeBootstrapPort` from the supplied application context inside `execute`, so they never create a second Nest context.

Admin input:

```typescript
{
  username: process.env.ADMIN_USERNAME?.trim() || 'admin',
  password: process.env.ADMIN_PASSWORD,
  adminUiUrl: (
    process.env.ADMIN_UI_URL?.trim() || 'http://localhost:5173'
  ).replace(/\/$/, ''),
}
```

Acme has no secret input. Both imports remain side-effect free. Under the main-module guard, a shared fail-closed helper explicitly terminates with status `0` or `1` after the runtime returns; a rejected runtime also exits `1`. Explicit termination is required because a failed partial Nest initialization can leave referenced database handles even when no application context is returned for cleanup.

- [ ] **Step 4: Bind providers and scripts**

`ApplicationModule` binds/exports both bootstrap ports/process managers and `BootstrapStepRunner`. `InfrastructureModule` binds/exports process repository and cross-tenant lookup ports/adapters.

Add:

```json
{
  "bootstrap:admin:prod": "node dist/cli/bootstrap-admin.js",
  "bootstrap:acme:prod": "node dist/cli/bootstrap-acme.js"
}
```

- [ ] **Step 5: Verify and commit**

```bash
yarn workspace @auth/service test --runInBand --watchman=false test/cli/bootstrap-runtime.spec.ts test/application/process-managers/admin-bootstrap.process-manager.spec.ts test/application/process-managers/acme-bootstrap.process-manager.spec.ts
yarn workspace @auth/service test:arch
yarn workspace @auth/service build
test -f service/dist/cli/bootstrap-admin.js
test -f service/dist/cli/bootstrap-acme.js
git add service/src/cli service/test/cli/bootstrap-runtime.spec.ts service/src/application/application.module.ts service/src/infrastructure/infrastructure.module.ts service/package.json
git commit -m "feat(service): 운영 bootstrap CLI 연결"
```

---

### Task 7: Operator configuration and documentation

**Files:**

- Modify: `service/.env.example`
- Modify: `deploy/base/configmap.yaml`
- Modify: `deploy/overlays/production/secret.example.yaml`
- Modify: `README.md`

- [ ] **Step 1: Remove duplicate startup configuration**

Remove `DB_MIGRATIONS_RUN_ON_STARTUP`. Keep the legacy credentials documented as:

```yaml
# Required by preserved Migration20260404000001 on a fresh database.
# bootstrap:admin:prod also uses these only when the admin is missing.
ADMIN_USERNAME: admin
ADMIN_PASSWORD: replace-with-strong-admin-password
```

State bootstraps are explicit and not run on every replica.

- [ ] **Step 2: Document commands**

```bash
node service/dist/cli/migrate.js
node service/dist/cli/bootstrap-admin.js
node service/dist/cli/bootstrap-acme.js
node service/dist/main.js
```

Keep Yarn MikroORM CLI under development-only instructions. State that the acme bootstrap creates only the tenant and built-in scopes, never an OIDC client/application, and document the no-overwrite rule.

- [ ] **Step 3: Format and commit**

```bash
yarn prettier --write service/.env.example deploy/base/configmap.yaml deploy/overlays/production/secret.example.yaml README.md
git diff --check
git add service/.env.example deploy/base/configmap.yaml deploy/overlays/production/secret.example.yaml README.md
git commit -m "docs(service): migration과 bootstrap 운영 절차 분리"
```

---

### Task 8: Full tests and real image verification

**Files:**

- Modify only after a new failing test reproduces an integration defect.

- [ ] **Step 1: Run repository verification**

```bash
yarn workspace @auth/service test --runInBand --watchman=false
yarn workspace @auth/service test:unit:cov
yarn workspace @auth/service test:arch
yarn workspace @auth/service build
git diff --check
```

Expected: all tests pass, overall coverage ≥85%, security-critical domain coverage ≥90%, architecture passes, and build succeeds.

- [ ] **Step 2: Build and inspect final image**

```bash
DOCKER_BUILDKIT=0 docker build -f deploy/docker/Dockerfile.service -t auth-service:migration-bootstrap-verification .
docker run --rm --entrypoint sh auth-service:migration-bootstrap-verification -lc 'test -f dist/cli/migrate.js && test -f dist/cli/bootstrap-admin.js && test -f dist/cli/bootstrap-acme.js && test -f dist/infrastructure/mikro-orm/migrations/postgresql/Migration20260829000000.js && test ! -e mikro-orm.config.ts && test ! -d src && test ! -e /app/node_modules/typescript && test ! -e /app/node_modules/@mikro-orm/cli'
```

- [ ] **Step 3: Start isolated dependencies**

Resolve exact names first:

```bash
docker ps -a --filter name=auth-migration-postgres-20260829 --filter name=auth-migration-redis-20260829 --filter name=auth-migration-service-20260829
docker network ls --filter name=auth-migration-verification-20260829
```

Create only if absent:

```bash
docker network create auth-migration-verification-20260829
docker run -d --name auth-migration-postgres-20260829 --network auth-migration-verification-20260829 -e POSTGRES_DB=auth -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=verification-db-password postgres:16-alpine
docker run -d --name auth-migration-redis-20260829 --network auth-migration-verification-20260829 redis:7-alpine
until docker exec auth-migration-postgres-20260829 pg_isready -U postgres -d auth; do sleep 1; done
until docker exec auth-migration-redis-20260829 redis-cli ping | grep -q PONG; do sleep 1; done
```

- [ ] **Step 4: Start image and prove migration precedes HTTP**

Start the exact service container:

```bash
docker run -d --name auth-migration-service-20260829 --network auth-migration-verification-20260829 -p 33000:3000 -e NODE_ENV=production -e DB_DRIVER=postgresql -e DB_HOST=auth-migration-postgres-20260829 -e DB_PORT=5432 -e DB_NAME=auth -e DB_USER=postgres -e DB_PASSWORD=verification-db-password -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD='Admin1234!' -e ADMIN_UI_URL=http://localhost:5173 -e REDIS_URL=redis://auth-migration-redis-20260829:6379 -e OIDC_ISSUER=http://localhost:33000 -e OIDC_COOKIE_KEYS=verification-cookie-key-one-32-characters,verification-cookie-key-two-32-characters -e JWKS_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef -e OTP_TOKEN_SECRET=verification-otp-token-secret-32-characters auth-service:migration-bootstrap-verification
```

```bash
until curl --fail --silent http://localhost:33000/health >/dev/null; do docker ps --filter name=auth-migration-service-20260829 --format '{{.Status}}'; sleep 1; done
docker logs auth-migration-service-20260829
```

Expected: container remains running, health succeeds, and logs contain no supplied passwords or raw migration stack.

- [ ] **Step 5: Verify migration and schema**

```bash
docker exec auth-migration-postgres-20260829 psql -U postgres -d auth -c 'SELECT name, executed_at FROM mikro_orm_migrations ORDER BY name;'
docker exec auth-migration-postgres-20260829 psql -U postgres -d auth -c '\d bootstrap_process'
docker exec auth-migration-postgres-20260829 psql -U postgres -d auth -c "SELECT code, name FROM tenant WHERE code = 'master';"
```

Expected: history includes `Migration20260829000000` and master exists.

- [ ] **Step 6: Run both compiled bootstraps**

Run administrator bootstrap:

```bash
docker run --rm --network auth-migration-verification-20260829 -e NODE_ENV=production -e DB_DRIVER=postgresql -e DB_HOST=auth-migration-postgres-20260829 -e DB_PORT=5432 -e DB_NAME=auth -e DB_USER=postgres -e DB_PASSWORD=verification-db-password -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD='Admin1234!' -e ADMIN_UI_URL=http://localhost:5173 -e REDIS_URL=redis://auth-migration-redis-20260829:6379 -e OIDC_ISSUER=http://localhost:33000 -e OIDC_COOKIE_KEYS=verification-cookie-key-one-32-characters,verification-cookie-key-two-32-characters -e JWKS_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef -e OTP_TOKEN_SECRET=verification-otp-token-secret-32-characters auth-service:migration-bootstrap-verification node dist/cli/bootstrap-admin.js
```

Run acme bootstrap:

```bash
docker run --rm --network auth-migration-verification-20260829 -e NODE_ENV=production -e DB_DRIVER=postgresql -e DB_HOST=auth-migration-postgres-20260829 -e DB_PORT=5432 -e DB_NAME=auth -e DB_USER=postgres -e DB_PASSWORD=verification-db-password -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD='Admin1234!' -e ADMIN_UI_URL=http://localhost:5173 -e REDIS_URL=redis://auth-migration-redis-20260829:6379 -e OIDC_ISSUER=http://localhost:33000 -e OIDC_COOKIE_KEYS=verification-cookie-key-one-32-characters,verification-cookie-key-two-32-characters -e JWKS_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef -e OTP_TOKEN_SECRET=verification-otp-token-secret-32-characters auth-service:migration-bootstrap-verification node dist/cli/bootstrap-acme.js
```

The image entrypoint applies pending migrations before each command.

- [ ] **Step 7: Query literal data and counts**

```bash
docker exec auth-migration-postgres-20260829 psql -U postgres -d auth -c "SELECT code, name FROM tenant WHERE code = 'acme';"
docker exec auth-migration-postgres-20260829 psql -U postgres -d auth -c "SELECT COUNT(*) AS e_vote_clients FROM client WHERE client_id = 'e-vote';"
docker exec auth-migration-postgres-20260829 psql -U postgres -d auth -c "SELECT process_key, step, status, retry_count, last_failure_code FROM bootstrap_process ORDER BY process_key;"
docker exec auth-migration-postgres-20260829 psql -U postgres -d auth -c "SELECT (SELECT COUNT(*) FROM tenant WHERE code IN ('master', 'acme')) AS tenants, (SELECT COUNT(*) FROM client WHERE client_id = '__admin-portal__') AS clients, (SELECT COUNT(*) FROM \"user\" u JOIN tenant t ON t.id = u.tenant_id WHERE t.code = 'master' AND u.username = 'admin') AS admins;"
```

Expected: `acme` exists, `e_vote_clients=0`, completed process rows, tenants=2, clients=1, admins=1.

- [ ] **Step 8: Prove idempotency and restart**

Run both bootstrap commands again, repeat Step 7, and confirm identical values/counts. Restart the service and wait for health. Migration row count and bootstrap row counts must remain unchanged.

- [ ] **Step 9: Remove only named verification resources**

```bash
docker rm -f auth-migration-service-20260829 auth-migration-postgres-20260829 auth-migration-redis-20260829
docker network rm auth-migration-verification-20260829
```

No named volume is created.

- [ ] **Step 10: Record evidence**

If integration exposes a defect, first add the smallest failing test to the owning task, observe RED, make the minimal correction, and rerun Task 8. Otherwise do not create an empty commit.

```bash
git status --short
git log --oneline --decorate -8
```
