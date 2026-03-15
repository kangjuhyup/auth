# Skill: Adapter & Cache

## Trigger
- RDB adapter/repository 작성
- Redis adapter 작성
- Cache 전략 변경
- MikroORM entity 수정
- Infrastructure module 변경

## Rules

### MikroORM 사용 범위
허용:
- `infrastructure/mikro-orm/entities` — persistence entity만
- EntityManager는 adapter/repository 내부에서만 사용
- transaction은 infrastructure adapter 내부에서만

금지:
- domain 레이어에 MikroORM decorator
- application/domain에서 EntityManager 사용
- MikroORM entity를 레이어 경계 밖으로 노출

→ domain model ↔ MikroORM entity 매핑은 infra adapter에서 명시적으로 수행

### Cache Strategy
RDB가 source of truth, Redis는 best-effort cache:

```
Write: RDB 먼저 저장 → Redis 갱신 (실패해도 RDB 성공이면 OK)
Read:  Redis miss → RDB 조회 → Redis 갱신
```

캐시 허용 대상:
- `/.well-known/openid-configuration` (TTL: 10분)
- `/.well-known/jwks.json` (TTL: 5~10분, key rotation 시 즉시 무효화)
- public client metadata (TTL: 2~5분)
- provider config snapshot (non-secret)

캐시 금지 대상:
- tokens, authorization codes, sessions
- refresh tokens / grant state
- consent 결정 (버전 관리 없을 때)

### Cache Rules
- 캐시 장애가 기능 장애로 이어지면 안 됨
- 이벤트 기반 invalidation 우선, TTL은 fallback
- negative cache: 1~5초 짧은 TTL
- 캐시에 secret/token 로깅 금지

## Do
- RDB 먼저 쓰기
- 캐시는 best-effort (실패 허용)
- key rotation 이벤트 시 JWKS 캐시 즉시 purge
- negative TTL은 짧게 (1~5초)

## Don't
- 캐시 실패로 요청 실패 처리
- provider adapter 외부에서 token 캐싱
- 캐시 로그에 secret 포함

## Checklist
- [ ] MikroORM: infrastructure에만 위치
- [ ] entity ↔ domain model 명시적 매핑
- [ ] RDB write-first
- [ ] Redis best-effort (실패해도 정상 동작)
- [ ] 캐시 불가 데이터(token 등) 캐싱 안 됨
