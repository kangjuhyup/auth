# Tenant-isolated SSO and Back-channel SLO Design

**Date:** 2026-08-31

## Context

The authorization server creates one `node-oidc-provider` instance per tenant. Same-tenant SSO and back-channel logout work in the current implementation, but the provider storage and cookies are not tenant-scoped:

- RDB OIDC records are identified by `id` and `kind`, without `tenant_id`.
- Redis OIDC keys omit the tenant identifier.
- Session-index deletion paths can delete records by raw session or grant identifiers across tenants.
- Providers use the same default session-cookie names, signing keys, and root path.
- Enabling back-channel logout permits outbound requests to client-controlled URLs without a dedicated egress policy.

This makes same-browser cross-tenant session reuse, cross-tenant record collision, destructive logout, and server-side request forgery possible. Since this service has not been deployed, the migration may deliberately invalidate all transient OIDC sessions, grants, tokens, and session-index entries.

## Goals

- Preserve SSO among clients belonging to the same tenant.
- Prevent authentication state, grants, tokens, and logout notifications from crossing tenant boundaries.
- Support standards-compliant `node-oidc-provider` back-channel logout without reimplementing OIDC flows.
- Reject unsafe back-channel logout destinations before any network request is made.
- Prove same-tenant SSO/SLO and cross-tenant isolation using real HTTP E2E flows.
- Avoid logging credentials, tokens, database URLs, cookie keys, or logout-token contents.

## Non-goals

- Front-channel logout support beyond the provider's existing behavior.
- Changing the domain model or introducing CQRS aggregates for provider-internal transient state.
- Preserving existing OIDC sessions or tokens during this migration.
- Reimplementing authorization, token, interaction, session, or logout protocol processing.

## Selected Approach

Use explicit tenant identifiers at every persistence and cookie boundary, backed by a destructive migration of transient OIDC state. Add a dedicated safe Fetch implementation for provider-originated HTTP requests. Keep protocol processing inside `node-oidc-provider`.

Cookie-only isolation is insufficient because server-side records can still collide. Hashing tenant information into opaque record IDs without a schema change was also rejected because it obscures operational queries and leaves destructive lookup paths difficult to verify.

## Architecture and Dependency Boundaries

All production changes remain in `service/src/infrastructure` and MikroORM migrations. Presentation, application, and domain layers do not gain dependencies on `node-oidc-provider`, MikroORM, DNS, or HTTP transport details.

The provider continues to own OIDC validation and session/logout behavior. Infrastructure adapters only provide tenant-scoped persistence, cookie configuration, and outbound network policy.

## Tenant Identity Flow

Provider creation must resolve both the stable tenant ID and tenant code. Creation fails closed when no tenant exists.

- Tenant ID is used for database and Redis namespaces.
- Tenant code is used for URL-path-aligned cookie names and paths.
- Both values are passed explicitly through the provider configuration and adapter factory; neither is inferred from request-global mutable state.

The tenant ID is never accepted directly from an OIDC client parameter.

## RDB Persistence

### OIDC model table

Add a required `tenant_id` column to `oidc_model`. Its primary key becomes:

`(tenant_id, kind, id)`

Secondary indexes for UID, grant ID, and user code are recreated with tenant and kind prefixes. Every adapter operation includes the adapter's immutable tenant ID, including:

- insert/upsert
- find
- find by UID
- find by user code
- consume
- revoke by grant ID
- destroy

The MikroORM entity declares the same composite identity. Raw provider IDs remain unchanged inside a tenant.

### Session-index table

The session-index primary key becomes:

`(tenant_id, session_id, client_id)`

Every lookup and deletion includes tenant ID. Code must fail closed rather than issue an unscoped delete if tenant identity is missing.

### Migration strategy

Add new PostgreSQL, MySQL, and MSSQL migrations; do not edit already-published migrations. Each migration performs these operations in order:

1. Delete all rows from `oidc_session_index`.
2. Delete all rows from `oidc_model`.
3. Add required tenant columns and replace affected primary keys and indexes.

These tables contain transient protocol state, and the approved deployment behavior is to invalidate that state. Durable tenants, clients, accounts, consents, policies, and audit data are not deleted.

## Redis Persistence

Every key includes the immutable tenant ID:

`oidc:{tenantId}:{kind}:...`

This applies to primary values, grant/UID/user-code indexes, negative-cache entries, session-index entries, and reverse lookup keys. Session control groups or constructs adapters by tenant before revocation. No Redis scan or delete may operate on an unscoped raw provider ID.

Existing Redis OIDC keys are allowed to expire naturally or can be flushed during the same undeployed environment reset; new code will never read them.

## Cookie Isolation

Each provider receives tenant-specific names for session, interaction, and resume cookies. Cookie paths are restricted to the tenant route, for example `/t/acme`, so the browser does not send an ACME session to another tenant route.

Cookie signing keys are derived per tenant from the configured global cookie key material using a one-way HMAC construction with a versioned tenant context. The derived material is not logged or persisted. A future global key rotation therefore also rotates all tenant-derived keys.

Cookie security attributes remain aligned with provider requirements: secure cookies outside explicitly supported local test mode, HTTP-only where applicable, and the provider's appropriate SameSite behavior.

## Safe Back-channel HTTP

Configure the provider with a dedicated Fetch-compatible function for outbound back-channel requests. The policy applies at request time even when client data predates current DTO validation.

The implementation must:

- accept only HTTPS URLs;
- reject URL credentials;
- reject localhost names and literal loopback, private, link-local, multicast, unspecified, documentation, benchmark, reserved, and other non-global IP ranges for both IPv4 and IPv6;
- resolve DNS and reject the destination if any candidate address is non-global;
- use an HTTP transport lookup hook that validates and pins resolved addresses for the connection, preventing DNS time-of-check/time-of-use rebinding;
- disable automatic redirects so a logout token is never forwarded to a second destination;
- apply bounded connect and response timeouts;
- cap the response body consumed by diagnostics;
- return only sanitized failure metadata to logs and provider events.

The utility uses injected resolver and transport boundaries in tests. Production wiring uses secure defaults. A direct runtime dependency may be added for a transport or IP parser rather than relying on transitive packages.

Back-channel success and failure observability includes tenant ID, client ID, correlation ID when available, and a sanitized destination origin. It excludes logout tokens, authorization headers, URL credentials, query strings, and response bodies.

## Provider and Session-control Changes

The provider adapter factory constructs RDB or Redis adapters with tenant ID. Session control uses the tenant recorded in each session-index record for provider record deletion and grant revocation.

Back-channel logout remains enabled through the provider feature flag. RP-initiated logout and logout-token creation, signing, claims, notification fan-out, and session destruction remain provider-owned behavior.

## Testing Strategy

### Unit and infrastructure tests

- RDB adapter tests prove every operation is tenant-scoped and identical raw IDs do not collide.
- Redis adapter tests prove all primary, secondary, negative-cache, and session-index keys are tenant-scoped.
- Cookie configuration tests prove tenant-specific names, paths, and deterministic but distinct derived keys.
- Safe Fetch tests cover HTTP, URL credentials, literal private addresses, DNS answers containing a private address, IPv6 special ranges, DNS rebinding defense, redirect rejection, timeout behavior, and a permitted public HTTPS target.
- MikroORM metadata initialization runs with `connect: false` and confirms both OIDC entities and their composite keys are discoverable.
- Migration tests or schema assertions confirm each supported database receives the required columns, keys, and indexes.

Tests use mocks at infrastructure ports and do not require NestJS modules where a direct unit is sufficient.

### E2E tests

Keep the existing same-tenant scenario:

1. Log in to client A in tenant ACME.
2. Authorize client B in ACME without another login.
3. Log out from one client.
4. Verify valid signed back-channel logout tokens reach both clients and subsequent authorization requires login.

Add a cross-tenant scenario using the same browser agent and deliberately colliding client/provider identifiers:

1. Log in to ACME.
2. Start authorization in tenant BETA and verify that BETA requires its own login.
3. Log in to BETA and log out from BETA.
4. Verify only BETA clients receive logout notification.
5. Verify ACME still has SSO and receives no BETA logout token.

The mock relying party verifies the logout-token signature through JWKS and validates issuer, audience, subject/session identifier, `events`, `iat`, `jti`, and absence of `nonce`. Unsafe post-logout redirect URIs continue to be rejected.

Global Fetch and console interception in E2E teardown is restored in an outer `finally`. Servers and applications close with `Promise.allSettled`; cleanup failures are reported only after global state has been restored.

## Failure Behavior

- Missing tenant identity prevents provider creation or adapter construction.
- Missing tenant identity during a destructive session operation produces no database or Redis deletion.
- Unsafe or unresolved back-channel destinations fail the individual notification without exposing the logout token or weakening logout of local session state.
- Database migration failure stops startup through the existing compiled migration runner.

## Verification and Acceptance Criteria

- Targeted unit, adapter, migration, and E2E tests pass.
- The complete service Jest suite passes.
- Service TypeScript build and targeted lint pass.
- The production Docker image builds for AMD64 and ARM64 paths already supported by CI.
- A container-backed PostgreSQL/Redis E2E run proves same-tenant SSO/SLO and cross-tenant isolation.
- No log or test diagnostic contains passwords, database URLs, cookies, authorization codes, tokens, or logout-token payloads.
- An independent security/code review finds no unscoped provider-state operation or uncontrolled logout egress.

## Rollout

Because there is no deployed environment, apply the new migrations and restart Redis-backed test/development environments without compatibility bridging. All users must authenticate again after rollout. If deployment status changes before merge, this destructive rollout assumption must be revisited.
