# Skill: CQRS

## Trigger
- Command handler 작성/수정
- Query handler 작성/수정
- Projection 로직 변경
- Controller endpoint 추가

## Rules

### Write Side (Command)
- Command handler는 RDB에서 aggregate 로드
- projection 조회로 invariant 결정 금지
- ONE command → ONE aggregate root 변경
- 결과: aggregate 저장 → domain event emit → event bus 발행

### Read Side (Query)
- Query handler는 projection table/view만 읽음
- aggregate 로드 금지
- UI/Admin 조회에 최적화된 read model 사용

### Controller 매핑
- `GET` → Query side
- `POST / PUT / PATCH / DELETE` → Command side

### DTO 분리
- Command DTO: application/dto (private constructor + static of())
- Query DTO: application/dto (private constructor + static of())
- Request DTO: presentation/dto (class-validator 적용)
- Response DTO: presentation/dto (private constructor + static of())

## Do
- write/read 완전 분리
- command는 RDB에서 aggregate 로드
- query는 projection에서만 데이터 조회

## Don't
- projection으로 invariant 결정
- command handler에서 read model 반환 (id만 반환)

## Checklist
- [ ] Command: RDB에서 aggregate 로드
- [ ] Query: projection만 조회
- [ ] Controller: GET → Query, 나머지 → Command
- [ ] Projection: idempotent 구현됨
