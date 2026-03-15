# Skill: DDD / Aggregate

## Trigger
- Aggregate 생성/수정
- Domain invariant 추가
- 새 비즈니스 동작
- Multi-aggregate 워크플로우

## Rules

### Aggregate Design
- ONE command → ONE aggregate root
- Aggregate 내부에서 invariant 강제
- 이벤트는 과거형 네이밍 (e.g., ClientRegistered, KeyRotated)

### Target Business Aggregates
- ClientAggregate: 등록, redirect URI, auth 방식, scope 정책
- KeyRingAggregate: 키 로테이션 정책, active key, overlap window
- ConsentAggregate: 사용자 동의 정책 (필요 시)
- SecurityPolicyAggregate: PKCE 요구, grant 허용 정책

### Multi-Aggregate Workflow → Process Manager (Saga)
여러 aggregate가 관여하는 워크플로우는 반드시 Process Manager 사용:
- Process Manager 상태(correlationId, step, retries) 반드시 persist
- idempotent 구현, at-least-once delivery 지원
- 실패 시 compensating command/event 사용
- cross-aggregate ACID 시뮬레이션 금지

### Domain Rules
- 평문 secret 저장 금지 (hashing은 infra 책임)
- Domain은 opaque identifier만 저장 (raw key material 금지)

## Do
- Aggregate에서 invariant 검증 후 이벤트 emit
- 이벤트 이름은 과거형

## Don't
- 하나의 command에서 여러 aggregate 변경
- write side에서 projection 조회
- domain에 secret 저장
- cross-aggregate ACID 시뮬레이션

## Checklist
- [ ] invariant 강제됨
- [ ] 이벤트 emit됨
- [ ] domain에 외부 의존성 없음
- [ ] Multi-aggregate면 Process Manager 사용됨
