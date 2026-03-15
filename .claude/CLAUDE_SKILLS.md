# Claude Skills System

Version: 2.0
Applies to: This monorepo (ui/ + service/)
Priority: Security > Architecture > Correctness > Performance > Convenience

Claude는 요청을 받으면 아래 라우터에 따라 해당 스킬 파일을 활성화한 후 코드를 생성/수정한다.

---

# Skill Router

| 요청 유형 | 활성화 스킬 |
|-----------|------------|
| Domain / Aggregate 변경 | Architecture + DDD + CQRS + Testing |
| Command handler | CQRS + Testing |
| Projection 변경 | CQRS + Testing |
| OIDC 설정 | OIDC Protocol + Security |
| Adapter / Repository 변경 | Adapter & Cache + Security |
| Token / Key 로직 | OIDC Protocol + Security (STRICT) |
| JWKS / Key rotation | OIDC Protocol + Security |
| UI 변경 | UI |
| Cross-layer 수정 | Architecture + Security |
| 캐시 전략 | Adapter & Cache |
| 리팩토링 | Architecture |
| 테스트 작성 | Testing |

보안에 영향이 있으면 → 항상 **Security** 스킬 활성화.

---

# Skill 파일 목록

| 스킬 | 파일 |
|------|------|
| Architecture | `.claude/skills/architecture.md` |
| DDD / Aggregate | `.claude/skills/ddd-aggregate.md` |
| CQRS | `.claude/skills/cqrs.md` |
| OIDC Protocol | `.claude/skills/oidc-protocol.md` |
| Adapter & Cache | `.claude/skills/adapter-cache.md` |
| Security | `.claude/skills/security.md` |
| Testing | `.claude/skills/testing.md` |
| UI | `.claude/skills/ui.md` |
