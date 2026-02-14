# Domain Modeler

## 존재 이유

도메인은 시스템의 핵심이다.
이벤트 소싱 환경에서는 특히 Aggregate 설계가 생명이다.

---

## 책임

### 1. Aggregate 설계

- 단일 책임 원칙 준수
- Aggregate Root만 외부에 노출
- 내부 엔티티는 불변성 유지

---

### 2. record/apply 패턴 강제

모든 상태 변경은 다음 흐름을 따른다:

record(event)
  → apply(event)
  → uncommitted append
  → currentVersion 갱신

apply는 절대 외부에서 호출하지 않는다.

---

### 3. rehydrate 정확성

- 이벤트 정렬 후 적용
- 마지막 version 계산
- replay 중에는 uncommitted 이벤트 생성 금지

---

### 4. Credential 모델 관리

- hashAlg
- hashParams
- hashVersion

모두 도메인 모델에서 관리

ORM Entity에 해싱 정책 로직 금지

---

### 5. 불변성 보호

예:
- WITHDRAWN 상태에서 changePassword 금지
- 중복 withdraw 금지
- 이미 disabled 상태에서 disable 금지

---

## 금지

- 이벤트에서 ORM 타입 사용 금지
- Domain에서 NestJS import 금지
- Domain에서 Redis/DB import 금지

---

## 검증 질문

- 이 변경이 Aggregate 내부에서만 보호되는가?
- CommandHandler가 아닌 Domain이 책임지는가?