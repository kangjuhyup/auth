# Claude Skills System

Version: 1.0\
Applies to: This monorepo (ui/ + service/)\
Priority: Security \> Architecture \> Correctness \> Performance \>
Convenience

This document defines the internal Skill system Claude must use when
generating or modifying code.

Claude must: - Classify the request - Activate the appropriate Skill
set - Apply all Do/Don't/Checklist rules - Reject insecure patterns

------------------------------------------------------------------------

# 0. Global Skill Router

When a request is received, classify it:

  Request Type               Activate Skills
  -------------------------- ------------------------------------------
  Domain/Aggregate change    Architecture + DDD + CQRS + Testing
  Command handler            CQRS + EventSourcing + Testing
  Projection change          CQRS + Idempotency + Testing
  OIDC configuration         OIDC Protocol + Security
  Adapter change             Adapter + Cache + Security
  Token logic                OIDC Protocol + Security (STRICT)
  Key/JWKS rotation          OIDC Protocol + Security + Observability
  UI change                  UI Architecture + TanStack + Zustand
  Cross-layer modification   Architecture + Security Review
  Performance/caching        Adapter + Cache
  Refactor                   Architecture Guard
  Docs/OSS export            Documentation

If security is affected → Always activate Security Skill.

------------------------------------------------------------------------

# 1. Architecture Skill

## Trigger

-   Layer modification
-   Dependency injection change
-   Moving logic between layers

## Do

-   Maintain dependency direction:
    -   presentation → application → domain
    -   infrastructure → application → domain
-   Keep domain framework-free
-   Use ports in application layer
-   Keep provider glue in infrastructure only

## Don't

-   Import NestJS in domain
-   Import MikroORM in domain
-   Call application layer from domain
-   Put business logic in controller

## Checklist

-   [ ] Domain contains no framework imports
-   [ ] Infrastructure contains persistence logic only
-   [ ] Controllers delegate to handlers
-   [ ] Ports are respected

------------------------------------------------------------------------

# 2. DDD / Aggregate Skill

## Trigger

-   Creating/modifying aggregates
-   Adding domain invariants
-   New business behavior

## Do

-   One command → one aggregate
-   Enforce invariants inside aggregate
-   Emit past-tense events
-   Keep events immutable

## Don't

-   Mutate multiple aggregates in one command
-   Query projections in write side
-   Store secrets in domain

## Checklist

-   [ ] Invariants enforced
-   [ ] Events emitted
-   [ ] Version incremented
-   [ ] No external dependency in domain

------------------------------------------------------------------------

# 3. CQRS Skill

## Trigger

-   Command handler
-   Query handler
-   Projection logic

## Do

-   Write side reads only event store
-   Query side reads only projections
-   Separate DTOs per side

## Don't

-   Use projection for invariants
-   Use event store in query side

## Checklist

-   [ ] Command mutates only one aggregate
-   [ ] Query does not touch aggregate
-   [ ] Projection idempotent

------------------------------------------------------------------------

# 4. Event Sourcing Skill

## Trigger

-   EventStore logic
-   Rehydration logic
-   Version handling

## Do

-   Append-only store
-   Use optimistic concurrency
-   Sort events by version during replay

## Don't

-   Update/delete events
-   Generate side-effects during replay

## Checklist

-   [ ] expectedVersion used
-   [ ] Version strictly increasing
-   [ ] Replay safe

------------------------------------------------------------------------

# 5. OIDC Protocol Skill (STRICT)

## Trigger

-   node-oidc-provider config
-   Token format
-   findAccount
-   Resource indicators
-   PKCE
-   Grants

## Do

-   Let provider enforce protocol
-   Use resourceIndicators for JWT Access Token
-   Validate redirect_uri via provider
-   Require PKCE S256 for public clients

## Don't

-   Implement PKCE manually
-   Replace token signing pipeline
-   Bypass provider validation

## Checklist

-   [ ] Provider config lives in infrastructure
-   [ ] No manual token signing
-   [ ] PKCE enforced
-   [ ] Resource binding validated

------------------------------------------------------------------------

# 6. Adapter & Cache Skill

## Trigger

-   RDB adapter
-   Redis adapter
-   Hybrid adapter
-   Cache strategy

## Do

-   RDB is source of truth
-   Redis is best-effort cache
-   Use write-through strategy
-   Implement negative cache for miss
-   Apply TTL margin

## Don't

-   Let cache failure break functionality
-   Cache tokens outside provider adapter

## Checklist

-   [ ] RDB write first
-   [ ] Cache best-effort
-   [ ] Negative TTL small (1-5s)
-   [ ] No secrets in cache logs

------------------------------------------------------------------------

# 7. Security Skill (Highest Priority)

## Trigger

-   Token logic
-   Key rotation
-   Consent
-   Client validation
-   Resource validation
-   Authentication
-   Multi-tenant binding

## Do

-   Bind token to tenant
-   Validate resource origin (https only)
-   Log suspicious events
-   Enforce strict redirect URI validation
-   Protect against replay

## Don't

-   Weaken validation
-   Log secrets
-   Allow HTTP resource in production

## Checklist

-   [ ] Tenant binding validated
-   [ ] HTTPS enforced
-   [ ] No secret logging
-   [ ] Replay safe

------------------------------------------------------------------------

# 8. Testing Skill

## Trigger

-   New feature
-   Refactor
-   Bug fix

## Do

-   Write domain tests first
-   Mock external dependencies
-   Test security paths
-   Ensure ≥ 90% coverage for critical logic

## Don't

-   Skip security tests
-   Mock domain logic

## Checklist

-   [ ] Domain tests exist
-   [ ] Handler tests exist
-   [ ] Projection idempotency tested
-   [ ] Security tests included

------------------------------------------------------------------------

# End of Claude Skills
