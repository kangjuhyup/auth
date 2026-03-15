# Skill: Testing (TDD 필수)

## Trigger
- 새 기능 추가
- 리팩토링
- 버그 수정
- 모든 코드 변경

## Rules

### 테스트 작성 순서
1. Domain 테스트 (순수 TS): aggregate invariant + 이벤트 emit 검증
2. Command handler 테스트: Repository/EventBus port mock
3. Projector 테스트: idempotency 검증
4. Query handler 테스트: read model 매핑
5. Integration/E2E 테스트: provider 엔드포인트 + key flow

### 테스트 격리 규칙
- NestJS 모듈 의존성 없이 작성 (단위 테스트)
- 외부 서비스는 mock으로 교체
- 외부 서비스 전달값 검증 불필요 (호출 여부만)
- domain 로직은 mock 금지 (직접 테스트)

### 필수 보안 테스트
- invalid redirect_uri 거부 검증
- PKCE 누락/잘못된 verifier 거부 검증
- key rotation 후 signature 검증 계속 동작
- refresh reuse 감지 시 audit/revoke 정책 동작

### 커버리지 기준
- 보안 핵심 domain: ≥ 90%
- 전체: ≥ 85%

## Do
- domain 테스트 먼저 작성 (TDD)
- 외부 의존성 mock
- 보안 경로 테스트 포함
- projection idempotency 테스트

## Don't
- 보안 테스트 생략
- domain 로직 mock
- NestJS 모듈 로딩 필요한 단위 테스트

## Checklist
- [ ] Domain 테스트 존재
- [ ] Command handler 테스트 존재
- [ ] Projection idempotency 테스트 존재
- [ ] 보안 테스트 포함 (redirect_uri, PKCE 등)
- [ ] 커버리지 기준 충족
