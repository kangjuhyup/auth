# Claude AI Project Instructions

This repository is a **monorepo** with two main workspaces:

- `ui/` (frontend)
- `service/` (OIDC Authorization Server)

Core engine for OIDC is **node-oidc-provider**.
We extend it with domain logic and persistence, but we do **not** re-implement OAuth/OIDC flows.

**Security correctness overrides convenience.**

Claude must strictly follow the rules below. If a request violates them, propose a compliant alternative.

---

# 0. Monorepo Rules

## Workspace boundaries
- `ui/` and `service/` MUST be treated as separate applications.
- Do not introduce shared runtime coupling between `ui` and `service` unless explicitly requested.

## Shared packages (optional)
공유 패키지는 반드시 `packages/*` 하위에 위치.

Allowed: pure TypeScript types, UI-safe constants, lint/config tooling
Forbidden: server secrets, auth internals, node-oidc-provider config, persistence entities

---

# 1. Service Positioning

node-oidc-provider가 처리 (건드리지 않음):
- Authorization/token/userinfo/jwks endpoints
- PKCE, Grant validation, Session/Interaction

우리 코드가 처리:
- Client/Key/Consent/Policy 생명주기 관리
- Custom claims 주입 (provider 콜백 통해서만)
- Audit logging, Cache control, Multi-aggregate workflow

---

# 2. Architecture Stack (service/)

- NestJS, Clean Architecture, DDD, Hexagonal (Ports & Adapters)
- CQRS — business aggregate에만 적용
- MikroORM — infrastructure only
- Jest — TDD 필수

---

# 3. Dependency Direction

```
presentation → application → domain
infrastructure → application → domain
```

Domain은 NestJS, MikroORM, node-oidc-provider, decorator, framework exception에 절대 의존 금지.

> 상세 규칙: [`.claude/skills/architecture.md`](.claude/skills/architecture.md)

---

# 4. Folder Structure

```
service/src/
 ├── domain/
 │    ├── aggregates/
 │    ├── entities/
 │    ├── value-objects/
 │    ├── events/
 │    ├── errors/
 │    └── repositories/
 ├── application/
 │    ├── commands/
 │    │    ├── commands/
 │    │    ├── handlers/
 │    │    └── ports/
 │    ├── queries/
 │    │    ├── queries/
 │    │    ├── handlers/
 │    │    └── ports/
 │    ├── process-managers/
 │    └── dto/
 ├── infrastructure/
 │    ├── oidc-provider/
 │    ├── mikro-orm/
 │    │    ├── entities/
 │    │    ├── migrations/
 │    │    └── config/
 │    ├── event-store/
 │    ├── projections/
 │    ├── repositories/
 │    ├── adapters/
 │    ├── cache/
 │    ├── crypto/
 │    └── observability/
 ├── presentation/
 │    ├── controllers/
 │    ├── dto/
 │    └── http/
 └── main.ts
```

---

# 5. Output Rules

Backend (`service/`):
- 파일 경로 항상 명시
- 구현과 함께 테스트 제공
- controller에 비즈니스 로직 배치 금지
- application handler 우회 금지

Frontend (`ui/`):
- secret 임베딩 금지
- OIDC 흐름은 backend 엔드포인트에 맞춰 구현

---

# 6. Skills System

요청을 받으면 **반드시** 스킬 분류 후 해당 스킬 파일을 적용한다.

라우터 및 스킬 파일 목록: [`.claude/CLAUDE_SKILLS.md`](.claude/CLAUDE_SKILLS.md)

| 스킬 | 파일 |
|------|------|
| Architecture | [`.claude/skills/architecture.md`](.claude/skills/architecture.md) |
| DDD / Aggregate | [`.claude/skills/ddd-aggregate.md`](.claude/skills/ddd-aggregate.md) |
| CQRS | [`.claude/skills/cqrs.md`](.claude/skills/cqrs.md) |
| OIDC Protocol | [`.claude/skills/oidc-protocol.md`](.claude/skills/oidc-protocol.md) |
| Adapter & Cache | [`.claude/skills/adapter-cache.md`](.claude/skills/adapter-cache.md) |
| Security | [`.claude/skills/security.md`](.claude/skills/security.md) |
| Testing | [`.claude/skills/testing.md`](.claude/skills/testing.md) |
| UI | [`.claude/skills/ui.md`](.claude/skills/ui.md) |

---

# 7. Sub-Agent Rules

서브에이전트는 CLAUDE.md를 자동으로 읽지 않으므로 prompt에 반드시 포함:

1. 활성화된 스킬의 Do/Don't/Checklist
2. 의존 방향 제약 (presentation → application → domain)
3. CQRS 규칙 (Write: event store만, Read: projection만)
4. 테스트 규칙 (NestJS 모듈 의존성 X, mock 서비스 생성)

| 유형 | 용도 | 스킬 포함 |
|------|------|-----------|
| Explore | 코드베이스 탐색 | Architecture 포함 |
| Plan | 구현 계획 | 관련 스킬 전체 |
| Bash | 빌드/테스트 실행 | 불필요 |
| general-purpose | 복합 작업 | 관련 스킬 전체 |
