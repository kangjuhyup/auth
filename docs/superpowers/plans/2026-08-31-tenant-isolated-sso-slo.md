# Tenant-isolated SSO and SLO Implementation Plan

> Execute with strict red-green-refactor cycles. Do not change `node-oidc-provider` protocol behavior; only its infrastructure configuration, storage adapters, and tests.

**Goal:** Provide same-tenant SSO and back-channel SLO while preventing cross-tenant cookie, persistence, revocation, and outbound-request leakage.

**Architecture:** Resolve a stable tenant before provider construction, inject that tenant into all provider infrastructure, namespace every OIDC record and cookie, and route provider-originated requests through a fail-closed safe Fetch implementation. Add destructive transient-state migrations because no deployed sessions or tokens must be preserved.

**Stack:** NestJS, node-oidc-provider 9.6, MikroORM 6.6, PostgreSQL/MySQL/MSSQL, ioredis, Jest, Supertest.

---

## Task 1: Tenant-aware RDB model and adapter

**Files:**

- Modify: `service/src/infrastructure/mikro-orm/entities/oidc-model.ts`
- Modify: `service/src/infrastructure/oidc-provider/adapters/rdb-oidc.adapter.ts`
- Modify: `service/test/infrastructure/oidc-provider/adapter/rdb-oidc.adapter.spec.ts`

1. Add failing tests that construct two adapters with different tenant IDs and the same kind/raw ID. Assert every `findOne`, `nativeDelete`, create/upsert, UID, user-code, consume, and grant-revocation criterion contains `tenantId`.
2. Run `corepack yarn workspace @auth/service test --runInBand --watchman=false test/infrastructure/oidc-provider/adapter/rdb-oidc.adapter.spec.ts` and confirm the new assertions fail.
3. Add a required `tenantId` property to `OidcModelOrmEntity`, make `tenantId`, `kind`, and `id` composite primary keys, and prefix secondary indexes with tenant and kind.
4. Require tenant ID in `RdbOidcAdapter` construction and include it in every query, creation, and deletion criterion.
5. Re-run the focused test and refactor only after it passes.

## Task 2: Tenant-aware Redis adapter and session-index keys

**Files:**

- Modify: `service/src/infrastructure/oidc-provider/adapters/redis-oidc.adapter.ts`
- Modify: `service/src/infrastructure/oidc-provider/session/oidc-session-index.store.ts`
- Modify: `service/test/infrastructure/oidc-provider/adapter/redis-oidc.adapter.spec.ts`
- Modify: `service/test/infrastructure/oidc-provider/session/oidc-session-control.service.spec.ts`

1. Add failing tests proving identical kind/raw IDs, UID, user code, grant ID, and negative-cache identifiers use disjoint keys for two tenants.
2. Add failing session-index tests proving entry and reverse-lookup keys also include tenant ID and cannot be destroyed from another tenant.
3. Run the two focused specs and confirm RED.
4. Require tenant ID in `RedisAdapter`; centralize the prefix `oidc:${tenantId}:${kind}` and use it for every primary, secondary, grant, and negative-cache key.
5. Pass stable tenant ID directly to both session-index stores. Remove repository-based lazy tenant lookup and make all delete operations tenant-scoped.
6. Update Redis session entry and reverse-list key helpers to require tenant ID.
7. Re-run the focused specs until GREEN.

## Task 3: Adapter factory, provider identity, and session control

**Files:**

- Modify: `service/src/infrastructure/oidc-provider/adapters/oidc-apdater.factory.ts`
- Modify: `service/src/infrastructure/oidc-provider/oidc-provider.factory.ts`
- Modify: `service/src/infrastructure/oidc-provider/oidc-provider.config.ts`
- Modify: `service/src/infrastructure/oidc-provider/session/oidc-session-control.service.ts`
- Modify: `service/test/infrastructure/oidc-provider/adapter/oidc-adapter.factory.spec.ts`
- Modify: `service/test/infrastructure/oidc-provider/oidc-provider.factory.spec.ts`
- Modify: `service/test/infrastructure/oidc-provider/oidc-provider.config.spec.ts`
- Modify: `service/test/infrastructure/oidc-provider/session/oidc-session-control.service.spec.ts`

1. Add failing tests for missing tenant fail-closed provider creation, tenant ID propagation to all adapter drivers, and tenant-scoped RDB/Redis administrative revocation.
2. Run focused specs and confirm RED.
3. Fail provider creation when tenant lookup fails. Pass `tenant.id` and `tenant.code` explicitly into configuration and adapter factory.
4. Construct all RDB, Redis, and hybrid adapters/session-index stores with tenant ID.
5. Group session-control revocation records by tenant and include tenant ID in RDB deletion predicates and Redis adapter/key construction.
6. Re-run focused specs until GREEN.

## Task 4: Tenant-specific cookies

**Files:**

- Create: `service/src/infrastructure/oidc-provider/security/tenant-cookie.config.ts`
- Create: `service/test/infrastructure/oidc-provider/security/tenant-cookie.config.spec.ts`
- Modify: `service/src/infrastructure/oidc-provider/oidc-provider.config.ts`
- Modify: `service/test/infrastructure/oidc-provider/oidc-provider.config.spec.ts`

1. Add failing tests for safe tenant-code validation, distinct cookie names/paths, deterministic per-tenant key derivation, and different derived keys for two tenants.
2. Run the focused cookie/config specs and confirm RED.
3. Implement HMAC-SHA256 derivation from each configured cookie key using a versioned tenant context. Use sanitized tenant-specific cookie names and `/t/${tenantCode}` paths for long and short cookies.
4. Wire the helper into provider configuration without logging source or derived keys.
5. Re-run focused specs until GREEN.

## Task 5: Safe provider Fetch

**Files:**

- Create: `service/src/infrastructure/oidc-provider/security/safe-oidc-fetch.ts`
- Create: `service/test/infrastructure/oidc-provider/security/safe-oidc-fetch.spec.ts`
- Modify: `service/src/infrastructure/oidc-provider/oidc-provider.config.ts`
- Modify: `service/package.json`
- Modify: `yarn.lock`

1. Add failing tests for non-HTTPS URLs, URL credentials, localhost, private/reserved IPv4 and IPv6 literals, mixed public/private DNS results, redirect responses, connect/response timeout, and a public HTTPS success path.
2. Add a DNS-rebinding-focused test in which validation resolves a public address but a later unsafe address would be selected unless connection lookup is pinned.
3. Run the focused test and confirm RED.
4. Add direct runtime dependencies needed for Fetch transport control and IP classification, using Yarn 4 from the repository root.
5. Implement injectable resolver/transport seams. Production defaults validate all DNS answers, pin permitted answers in the transport lookup, use manual redirects, bounded timeouts, and sanitized errors.
6. Set the provider `fetch` configuration to the safe Fetch function.
7. Re-run the focused security/config specs until GREEN.

## Task 6: Destructive transient-state migrations and metadata smoke test

**Files:**

- Create: `service/src/infrastructure/mikro-orm/migrations/postgresql/Migration20260831000000.ts`
- Create: `service/src/infrastructure/mikro-orm/migrations/mysql/Migration20260831000000.ts`
- Create: `service/src/infrastructure/mikro-orm/migrations/mssql/Migration20260831000000.ts`
- Modify: `service/src/infrastructure/mikro-orm/entities/oidc-session-index.ts`
- Modify: `service/test/infrastructure/mikro-orm/config/mikro-orm.config.spec.ts`
- Create or modify the repository's migration/schema assertion spec if one exists.

1. Add failing metadata tests using `MikroORM.init({ ...config, connect: false })` and assert both entities plus their composite primary properties are discovered.
2. Add migration assertions for state deletion, `oidc_model.tenant_id`, `(tenant_id, kind, id)`, and `(tenant_id, session_id, client_id)` in all three dialects.
3. Run focused tests and confirm RED.
4. Mark `tenantId` primary on the session-index entity and align its indexes with tenant-prefixed access.
5. Implement dialect-specific migrations that delete only `oidc_model` and `oidc_session_index` contents before replacing columns, primary keys, and indexes. Do not modify historical migrations.
6. Run focused tests and a PostgreSQL container migration from a pre-change schema to the new schema.

## Task 7: Same-tenant and cross-tenant E2E

**Files:**

- Modify: `service/test/e2e/support/api-e2e-suite.ts`
- Modify: `service/test/e2e/support/mock-relying-party.ts`

1. Make E2E global Fetch/console restoration unconditional using an outer `finally`; close resources with `Promise.allSettled` and report cleanup errors afterward.
2. Update the mock relying party transport seam to work with the safe Fetch test injection while preserving real HTTP server behavior and JWKS signature verification.
3. Keep the same-tenant A-to-B SSO/SLO scenario.
4. Add a failing ACME/BETA scenario with colliding client/raw provider identifiers. Assert BETA requires login, BETA logout notifies only BETA, and ACME remains authenticated and unnotified.
5. Run `corepack yarn workspace @auth/service test:e2e --runInBand test/e2e/oidc.e2e-spec.ts` against the repository PostgreSQL/Redis E2E compose services and confirm GREEN.

## Task 8: Verification and review

1. Run all focused security, adapter, provider, session, migration, and metadata specs.
2. Run `corepack yarn workspace @auth/service test:unit`.
3. Run `corepack yarn workspace @auth/service build`.
4. Run targeted ESLint without auto-fixing unrelated files, then `git diff --check`.
5. Build and run the production Docker image against PostgreSQL/Redis, execute the compiled migration runner, and verify service health.
6. Exercise or inspect the repository's AMD64/ARM64 buildx workflow without pushing an image.
7. Request an independent security/code review and resolve all critical or important findings before reporting completion.

## Commit Boundaries

If commits are requested, keep them reviewable in this order:

1. `fix(service): isolate oidc persistence by tenant`
2. `fix(service): secure oidc cookies and outbound fetch`
3. `feat(service): migrate tenant-scoped oidc state`
4. `test(service): verify tenant-isolated sso and slo`

Do not commit, push, create a branch, or open a PR unless the user explicitly requests that repository mutation for this iteration.
