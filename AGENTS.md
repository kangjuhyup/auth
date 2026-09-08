# Codex AI Project Instructions

This repository is a **monorepo** with two main workspaces:

- `ui/` (frontend)
- `service/` (OIDC Authorization Server)

Core engine for OIDC is **node-oidc-provider**.
We extend it with domain logic and persistence, but we do **not** re-implement OAuth/OIDC flows.

**Security correctness overrides convenience.**

Codex must strictly follow the rules below. If a request violates them, propose a compliant alternative.

---

# 0. Monorepo Rules

## Workspace boundaries

- `ui/` and `service/` MUST be treated as separate applications.
- Do not introduce shared runtime coupling between `ui` and `service` unless explicitly requested.

## Shared packages (optional)

공유 패키지는 반드시 `packages/*` 하위에 위치.

Allowed: pure TypeScript types, UI-safe constants, lint/config tooling
Forbidden: server secrets, auth internals, node-oidc-provider config, persistence entities

## Mobile SDK boundary

- Flutter SDK는 `sdks/flutter/`의 독립 Dart package로 관리하며 Yarn workspace에 포함하지 않는다.
- SDK는 공개 OIDC discovery와 표준 endpoint 계약에만 의존하고 `service/` 내부 코드나 persistence model을 참조하지 않는다.
- public client에 client secret을 포함하지 않으며 Authorization Code + PKCE 처리는 검증된 AppAuth 구현에 위임한다.
- SDK release와 server image release는 독립적으로 수행하고 호환성은 공개 계약과 테스트로 검증한다.

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

Domain은 NestJS, MikroORM, node-oidc-provider, framework exception에 절대 의존 금지.
외부 라이브러리/프레임워크 데코레이터 사용 금지.
직접 만든 도메인 유틸 데코레이터는 도메인 순수성을 해치지 않고, 인프라/프레임워크/런타임 스캔 의존이 없을 때만 허용.

> 상세 규칙: [`skills/architecture.md`](skills/architecture.md)

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

공통 스킬 규칙은 루트 `skills/*.md`를 원본으로 관리한다.
Codex Skill manifest는 `.agents/skills/*/SKILL.md`, Codex custom agent manifest는 `.codex/agents/*.toml`에 포맷 wrapper만 둔다.

| 스킬            | 파일                                                 |
| --------------- | ---------------------------------------------------- |
| Architecture    | [`skills/architecture.md`](skills/architecture.md)   |
| DDD / Aggregate | [`skills/ddd-aggregate.md`](skills/ddd-aggregate.md) |
| CQRS            | [`skills/cqrs.md`](skills/cqrs.md)                   |
| OIDC Protocol   | [`skills/oidc-protocol.md`](skills/oidc-protocol.md) |
| Adapter & Cache | [`skills/adapter-cache.md`](skills/adapter-cache.md) |
| Security        | [`skills/security.md`](skills/security.md)           |
| Testing         | [`skills/testing.md`](skills/testing.md)             |
| UI              | [`skills/ui.md`](skills/ui.md)                       |

---

# 7. Sub-Agent Rules

서브에이전트는 AGENTS.md를 자동으로 읽지 않으므로 prompt에 반드시 포함:

1. 활성화된 스킬의 Do/Don't/Checklist
2. 의존 방향 제약 (presentation → application → domain)
3. CQRS 규칙 (Write: event store만, Read: projection만)
4. 테스트 규칙 (NestJS 모듈 의존성 X, mock 서비스 생성)

| 유형            | 용도             | 스킬 포함         |
| --------------- | ---------------- | ----------------- |
| Explore         | 코드베이스 탐색  | Architecture 포함 |
| Plan            | 구현 계획        | 관련 스킬 전체    |
| Bash            | 빌드/테스트 실행 | 불필요            |
| general-purpose | 복합 작업        | 관련 스킬 전체    |

---

## RV Workflow plugin

This fragment is opt-in. Apply it only after reviewing the dry-run report for this project; it never replaces an existing `AGENTS.md`.

Use the smallest plugin-qualified role skill that covers the task: `$rv-workflow:backend`, `$rv-workflow:frontend`, `$rv-workflow:document`, `$rv-workflow:qa`, or `$rv-workflow:planner`. Use `$rv-workflow:project-toolchain` before executable work and its no-op path for prose-only work.

At the start of every tool-using agent task, including read-only inspection, status checks, and small tasks, invoke `$rv-workflow:task-progress` only long enough to resolve its installed plugin root, then run `npm --prefix <plugin-root> run progress:ensure -- --color --workspace <project-root>` exactly once before any role or task classification. This startup is independent of task tracking: it reuses a live watcher and opens a panel only when one is absent. An ensured watcher exits after the workspace has remained on completed work for 30 seconds. If a tracked task is created after the initial startup call, run the same `progress:ensure` command once immediately after creation so slow classification cannot leave that task without a panel. Do not pass `--task-id`. Pure conversational responses that require no tools do not launch the panel.

For explicitly tracked or medium/large work, use `$rv-workflow:task-progress` only at phase boundaries (task/step creation, step start, major milestone, block, completion or skip). Small questions, status checks, file lookups, localized routine edits, and routine commits remain untracked even though the shared panel startup runs. The inline MCP dashboard is read-only; write progress explicitly through the MCP tools. The terminal companion may apply only its confirmed, allowlisted step commands through the same task service. Repeat `--ensure-panel` once just after tracked task creation, but not at later milestones.

Before sending a final response for tracked work, the coordinating agent must read the latest task snapshot. It must not leave a runnable step `pending` or `in_progress`: start and complete the step with evidence, or skip it with a concrete reason when it is genuinely unnecessary. Never infer step completion from an agent or terminal disappearing. Render the dashboard once the task is completed or blocked so the final recorded state is visible.
