# Claude Skills System

Version: 2.0
Applies to: This monorepo (ui/ + service/)
Priority: Security > Architecture > Correctness > Performance > Convenience

Claude는 요청을 받으면 아래 라우터에 따라 해당 스킬 파일을 활성화한 후 코드를 생성/수정한다.

---

# Skill Router

| 요청 유형                 | 활성화 스킬                         |
| ------------------------- | ----------------------------------- |
| Domain / Aggregate 변경   | Architecture + DDD + CQRS + Testing |
| Command handler           | CQRS + Testing                      |
| Projection 변경           | CQRS + Testing                      |
| OIDC 설정                 | OIDC Protocol + Security            |
| Adapter / Repository 변경 | Adapter & Cache + Security          |
| Token / Key 로직          | OIDC Protocol + Security (STRICT)   |
| JWKS / Key rotation       | OIDC Protocol + Security            |
| UI 변경                   | UI                                  |
| Cross-layer 수정          | Architecture + Security             |
| 캐시 전략                 | Adapter & Cache                     |
| 리팩토링                  | Architecture                        |
| 테스트 작성               | Testing                             |

보안에 영향이 있으면 → 항상 **Security** 스킬 활성화.

---

# Skill 파일 목록

공통 규칙 원본은 루트 `skills/*.md`에 둔다.
`.claude/skills/*.md`는 Claude가 읽기 위한 wrapper만 유지한다.

| 스킬            | 파일                      |
| --------------- | ------------------------- |
| Architecture    | `skills/architecture.md`  |
| DDD / Aggregate | `skills/ddd-aggregate.md` |
| CQRS            | `skills/cqrs.md`          |
| OIDC Protocol   | `skills/oidc-protocol.md` |
| Adapter & Cache | `skills/adapter-cache.md` |
| Security        | `skills/security.md`      |
| Testing         | `skills/testing.md`       |
| UI              | `skills/ui.md`            |
