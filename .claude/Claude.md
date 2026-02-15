# Claude AI Project Instructions

This repository is a **monorepo** with two main workspaces:

- `ui/` (frontend)
- `service/` (OIDC Authorization Server)

Core engine for OIDC is **node-oidc-provider**.
We extend it with domain logic and persistence, but we do **not** re-implement OAuth/OIDC flows.

Security correctness overrides convenience.

Claude must strictly follow the rules below. If a request violates them, propose a compliant alternative.

---

# 0. Monorepo Rules

## Workspace boundaries
- `ui/` and `service/` MUST be treated as separate applications.
- Do not introduce shared runtime coupling between `ui` and `service` unless explicitly requested.

## Shared packages (optional)
If a shared package is introduced, it must be under:
- `packages/*` (recommended)

Allowed shared code:
- pure TypeScript types (DTO schemas, OpenAPI types)
- UI-safe constants
- lint/config tooling

Forbidden shared code:
- server secrets, auth internals
- node-oidc-provider configuration objects
- persistence entities
- anything that would cause ui to import server-only modules

---

# 1. Service Positioning: node-oidc-provider is the Protocol Engine

In `service/`, node-oidc-provider handles OIDC protocol mechanics:
- Authorization/token/userinfo/jwks endpoints
- PKCE validation
- ID token generation/signing (using provided keys)
- Grants validation and internal session/interaction mechanics

Our service code handles:
- Client lifecycle management (registration/update/policies)
- Key rotation lifecycle
- Consent policy & persistence (as needed)
- Custom claims enrichment (carefully)
- Audit logging
- Cache control for public config endpoints
- Operational safety: idempotency, rate-limits, observability
- Multi-aggregate workflows (Saga/Process Manager)

We extend the provider; we do not replace it.

---

# 2. Architecture Model Used in service/

`service/` uses:
- NestJS
- Clean Architecture
- DDD (Aggregate-centric)
- Hexagonal Architecture (Ports & Adapters)
- CQRS (STRICT separation where applied)
- Event Sourcing (for business aggregates only)
- MikroORM (infrastructure only)
- Jest (TDD mandatory)

IMPORTANT SCOPING:
- CQRS + Event Sourcing applies to business domain aggregates (clients, keys, consent, policies, audit).
- Token issuance itself inside node-oidc-provider is NOT modeled as event-sourced domain logic.

---

# 3. Dependency Direction (Clean Architecture)

In `service/`:

presentation → application → domain  
infrastructure → application → domain  

Domain must NEVER depend on:
- NestJS
- MikroORM
- node-oidc-provider
- decorators
- persistence entities
- framework exceptions

No exceptions.

---

# 4. Monorepo Folder Structure

## Root
- `ui/` (frontend app)
- `service/` (backend OIDC service)
- `packages/` (optional shared libs)
- config files at root (eslint, prettier, tsconfig base, etc.)

## service/ structure (mandatory)
service/src/
 ├── domain/
 │    ├── aggregates/
 │    ├── entities/
 │    ├── value-objects/
 │    ├── events/
 │    ├── errors/
 │    └── repositories/            (interfaces only, when needed)
 │
 ├── application/
 │    ├── command/
 │    │    ├── commands/
 │    │    ├── handlers/
 │    │    └── ports/
 │    ├── query/
 │    │    ├── queries/
 │    │    ├── handlers/
 │    │    └── ports/
 │    ├── process-managers/        (sagas)
 │    └── dto/
 │
 ├── infrastructure/
 │    ├── oidc-provider/           (provider bootstrap + adapter glue)
 │    ├── mikro-orm/
 │    │    ├── entities/           (persistence models ONLY)
 │    │    ├── migrations/
 │    │    └── config/
 │    ├── event-store/
 │    ├── projections/
 │    ├── repositories/
 │    ├── adapters/
 │    ├── cache/
 │    ├── crypto/                  (key material handling helpers)
 │    └── observability/
 │
 ├── presentation/
 │    ├── controllers/             (admin APIs, health, etc.)
 │    └── http/                    (middleware/filters if needed)
 │
 └── main.ts

## ui/ structure

`ui/` is a React application using:

- React + TypeScript
- Vite (bundler)
- TanStack Query (server state)
- Ant Design (UI components)
- Zustand (client state)

UI rules (MANDATORY):

---

### 1. Build System (Vite)

- Use Vite for bundling and dev server.
- Use ES modules only.
- Avoid Node-specific APIs in client code.
- Environment variables must use `import.meta.env`.
- Only expose variables prefixed with `VITE_`.
- Never expose secrets in environment variables.
- Use code-splitting for large route modules.
- Keep bundle size optimized (no unnecessary polyfills).

Do NOT:
- Use webpack-specific configs.
- Use CommonJS imports.
- Access process.env directly.

---

### 2. React + TypeScript

- Use functional components only.
- Strict TypeScript mode.
- Prefer composition over inheritance.
- Keep components small and reusable.
- Avoid large "god components".

---

### 3. TanStack Query (Server State)

- ALL API communication must use TanStack Query.
- No manual `useEffect + fetch` patterns for server state.
- Use centralized query key factory (e.g. `queryKeys.ts`).
- Mutations must invalidate relevant queries.
- Avoid storing server state in Zustand.

Optimistic updates:
- Allowed only when consistency risk is minimal.
- Otherwise refetch after mutation.

---

### 4. Zustand (Client/UI State Only)

Zustand is ONLY for:

- UI state (modals, tabs, toggles)
- Wizard state before submit
- Local preferences (theme, filters before fetch)

Forbidden:
- Storing server authoritative data
- Storing tokens insecurely
- Duplicating TanStack Query cache

---

### 5. Ant Design (UI Framework)

- Use Ant Design components for consistency.
- Use antd Form for complex forms.
- Validate client-side but enforce rules server-side.
- Use antd `message` or `notification` for UX feedback.
- Follow theme/token configuration centrally.

Avoid:
- Excessive custom CSS overriding antd.
- Inline styles unless necessary.

---

### 6. Authentication Handling (OIDC UI Flow)

- UI must NOT implement OIDC logic manually.
- Redirect to backend authorization endpoints.
- Handle redirects and callbacks cleanly.
- Never parse/validate JWT manually in UI.
- Never store client secrets.

---

### 7. Networking Layer

- Use a single API client module (e.g. `src/lib/apiClient.ts`).
- Attach correlationId if available.
- Handle 401/403 globally.
- Never log tokens.

---

### 8. Monorepo Sharing

Shared code must live in `packages/*`:

Allowed:
- Type-only DTOs
- OpenAPI-generated types
- Shared constants (non-secret)

Forbidden:
- Server provider configuration
- MikroORM entities
- Secrets or key material
---

# 5. node-oidc-provider Integration Rules (service/infra only)

node-oidc-provider MUST be configured and instantiated in:
- `service/src/infrastructure/oidc-provider/*`

Rules:
- Provider configuration is infrastructure code.
- Provider adapters may call application query ports to load read models (clients, keys, consent views).
- Provider hooks may call application command ports only when absolutely necessary (prefer minimal write operations in provider callbacks).

Forbidden:
- Implementing PKCE manually
- Implementing your own token signing pipeline (unless provider requires a callback and it is strictly limited)
- Replacing provider’s grant validation logic without a security review

---

# 6. CQRS Rules (service/)

## Write side (Command)
- Commands mutate ONE aggregate root per command.
- Aggregates enforce invariants and emit domain events.
- Write side reads ONLY the event store (rehydration) for aggregate decisions.
- Write side must NOT query projections to decide invariants.

## Read side (Query)
- Query handlers read ONLY projection tables/views.
- Query handlers must NOT load aggregates or access event store.
- Query side may be optimized for UI/admin views.

Controllers:
- GET → Query side
- POST/PUT/PATCH/DELETE → Command side

---

# 7. Event Sourcing Rules (service/)

- Event store is append-only.
- Events are immutable and named in past tense.
- Use optimistic concurrency (expectedVersion).
- Never update/delete events; use compensating events if needed.
- Snapshot is optional and strictly an infrastructure optimization.

Event sourcing applies to business aggregates such as:
- ClientAggregate
- KeyRingAggregate
- ConsentAggregate (if used)
- SecurityPolicyAggregate (optional)
- AuditLogAggregate (optional; often better as append-only projection)

---

# 8. MikroORM Rules (service/)

MikroORM is allowed ONLY in infrastructure layer.

Allowed:
- persistence entities in `infrastructure/mikro-orm/entities`
- EntityManager usage inside adapters/repositories
- transactions inside infrastructure adapters (event store, projector)

Forbidden:
- MikroORM decorators in domain
- EntityManager in application/domain
- using MikroORM entities as domain entities
- leaking MikroORM entities across layer boundaries

Mapping must be explicit in infrastructure.

---

# 9. Multi-Aggregate Transaction Strategy (CRITICAL)

Golden Rule:
- ONE command mutates ONE aggregate.

If a workflow requires multiple aggregates:
- Use a Process Manager (Saga) driven by events.

Rules:
- Process manager state (correlationId, step, retries) MUST be persisted.
- Must be idempotent; supports at-least-once delivery.
- No cross-aggregate ACID simulation.
- Use compensating commands/events on failure.
- Projectors must be idempotent (by version/eventId).

When atomicity is truly required:
- Redesign: move invariants into a single aggregate boundary.

---

# 10. Cache Strategy (Single Service)

Caching is allowed ONLY for non-authoritative, public data.

Cache allowed:
- Discovery: `/.well-known/openid-configuration`
- JWKS: `/.well-known/jwks.json`
- public client metadata (if safe)
- provider config snapshot (non-secret)

Never cache:
- tokens, authorization codes, sessions
- refresh tokens / grant state
- consent decisions unless authoritative and versioned and still treated carefully

Cache rules:
- Cache lives in infrastructure only.
- Event-driven invalidation preferred; TTL is fallback.

TTL guidance:
- discovery: 10 minutes
- JWKS: 5–10 minutes + purge on key rotation event
- client public metadata: 2–5 minutes

---

# 11. OIDC Domain Modeling Guidance (service/)

We rely on provider for protocol flow, but we model business lifecycle safely.

Suggested business aggregates:
- ClientAggregate: registration, redirect URIs, auth methods, scopes policy
- KeyRingAggregate: rotation policy, active key, overlap window metadata
- ConsentAggregate: user consent policy (if not fully delegated to provider)
- SecurityPolicyAggregate: enforce policies like "PKCE required", allowed grants per client type

Rules:
- Never store plaintext secrets. Store hashed secrets (infra concern).
- Domain stores opaque identifiers, not raw key material.
- Events capture security-relevant transitions (ClientUpdated, KeyRotated, ConsentGranted, ConsentRevoked, PolicyChanged).

---

# 12. OIDC Security Hardening (Production Mode)

node-oidc-provider is the primary enforcement mechanism; we must not weaken it.

PKCE:
- Require PKCE for all public clients.
- Allow only S256.
- Do not introduce custom PKCE logic.

Authorization code replay / refresh token reuse:
- Prefer provider built-ins.
- If hooks expose signals (e.g., reuse detected), emit audit domain events and revoke per policy.

Key rotation:
- Maintain overlap window (active + previous valid keys).
- JWKS must expose valid keys during overlap.
- Purge JWKS caches on KeyRotated.

State/nonce:
- Rely on provider; do not hand-roll.

Custom claims:
- Allowed only via provider configuration callbacks.
- Must not leak internal domain state or sensitive fields.
- Must be deterministic and policy-driven.

---

# 13. Observability & Logging

Must log (no secrets):
- client auth failures (clientId, reason)
- key rotations (kid, correlationId)
- consent changes
- suspicious events (replay/reuse detection indicators)
- admin actions on client/key/policy aggregates

Never log:
- tokens, authorization codes, secrets, raw key material

All logs must include:
- correlationId (or requestId)
- clientId (when relevant)
- userId (only when already authenticated/known)

---

# 14. Rate Limiting / Abuse Protection

Required protections (service/):
- token endpoint throttling
- authorization endpoint brute-force mitigation
- suspicious refresh patterns detection (if available)

Counters are non-authoritative and short TTL.
Never base domain invariants on cache counters.

---

# 15. Testing Strategy (TDD Mandatory)

Order:
1) Domain tests (pure TS): aggregates emit correct events + enforce invariants
2) Command handler tests: mock EventStorePort/EventBusPort
3) Projector tests: idempotency and version handling
4) Query handler tests: read model mapping
5) Integration/E2E tests: provider endpoints and key flows

Mandatory security tests:
- invalid redirect_uri rejected
- PKCE missing/wrong verifier rejected
- key rotation rollover continues verifying signatures
- refresh reuse signals cause expected policy action (audit/revoke)

Coverage:
- ≥ 90% for security-critical domain
- ≥ 85% overall

---

# 16. Output Rules for Claude

When generating backend features (`service/`):
- Always include file paths.
- Provide tests with implementation.
- Do not place business logic in controllers.
- Do not bypass application handlers.
- Keep provider callbacks thin and delegate to application ports.

When generating frontend features (`ui/`):
- Do not embed secrets.
- Prefer typed API clients generated from OpenAPI (if available).
- Keep OIDC flows aligned with backend endpoints; do not implement security logic in UI.

---

# 17. Security-First Rule

If a request weakens:
- provider security validation
- token/key integrity
- replay protection
- redirect_uri/client validation
- key rotation safety

Claude must reject it and propose a secure alternative.

node-oidc-provider is the source of protocol truth.
We extend it, not replace it.

---

# 18. Claude Skills System

See [CLAUDE_SKILLS.md](.claude/CLAUDE_SKILLS.md) for the full skill routing rules.

Claude must classify each request and activate the appropriate skill set before generating or modifying code.
Priority: Security > Architecture > Correctness > Performance > Convenience

---

# 19. Sub-Agent Rules

Claude Code는 Task tool을 통해 서브에이전트를 생성할 수 있다.
서브에이전트는 CLAUDE.md를 자동으로 읽지 않으므로, 아래 규칙을 반드시 따른다.

## 서브에이전트 생성 시 필수 포함 컨텍스트

서브에이전트 prompt에 반드시 다음을 명시:

1. **활성화된 스킬 세트** — CLAUDE_SKILLS.md의 Skill Router에 따라 해당 작업에 필요한 스킬의 Do/Don't/Checklist를 prompt에 포함
2. **아키텍처 제약** — 의존 방향(presentation → application → domain), domain에 프레임워크 금지
3. **CQRS 규칙** — Write side는 event store만, Read side는 projection만
4. **테스트 규칙** — NestJS 모듈 의존성 X, mock 서비스 생성, 외부 서비스 전달값 검증 X

## 서브에이전트 유형별 가이드

| 유형 | 용도 | 스킬 포함 |
|------|------|-----------|
| Explore | 코드베이스 탐색, 패턴 분석 | Architecture Skill 포함 |
| Plan | 구현 계획 설계 | 관련 스킬 전체 포함 |
| Bash | 빌드, 테스트 실행 | 불필요 |
| general-purpose | 복합 작업 | 관련 스킬 전체 포함 |

## 금지사항

- 스킬 컨텍스트 없이 코드 생성/수정 작업을 서브에이전트에 위임하지 않는다
- 서브에이전트가 domain 레이어에 프레임워크 의존성을 추가하는 것을 허용하지 않는다
- 서브에이전트 결과물이 스킬 체크리스트를 통과하지 못하면 메인 에이전트가 수정한다