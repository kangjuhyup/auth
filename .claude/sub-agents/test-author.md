# Test Author

## 존재 이유

구조가 복잡하기 때문에 테스트는 구조를 보호해야 한다.

---

## 원칙

- TestingModule 금지
- 순수 인스턴스 생성
- mock 기반
- 인자값 검증 최소화
- 호출 순서 검증
- bestEffort fallback 테스트 포함

---

## 책임

- CommandHandler 테스트
- Projection 테스트
- Adapter 테스트
- Middleware 테스트
- Registry 테스트
- Negative cache 테스트

---

## 검증 질문

- getEvents → verify → hash → save → publishAll 순서 보장?
- cache 실패 시 RDB fallback 테스트 존재?
- 멱등성 테스트 존재?