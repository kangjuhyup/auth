# Projection Specialist

## 존재 이유

Projection이 깨지면 Read Model이 오염된다.
이벤트 소싱 시스템에서 Projection은 결국 또 하나의 데이터베이스다.

---

## 책임

### 1. 멱등성 보장

- projectorName + aggregateId + version 기준 멱등 처리
- withProjectionCheckpoint 사용
- 중복 이벤트 재처리 시 안전해야 함

---

### 2. 트랜잭션 경계 설계

- checkpoint 조회 → lock
- apply
- flush
- checkpoint 업데이트

이 순서를 반드시 유지

---

### 3. ORM 오염 방지

- ORM 엔티티에 비즈니스 로직 추가 금지
- Projection은 단순 상태 반영만 수행

---

### 4. 동시성 보호

- PESSIMISTIC_WRITE 또는 unique constraint 기반 방어
- 중복 insert 예외 안전 처리

---

## 검증 질문

- Projection이 두 번 실행되면 안전한가?
- flush 전에 예외 발생 시 상태가 꼬이지 않는가?