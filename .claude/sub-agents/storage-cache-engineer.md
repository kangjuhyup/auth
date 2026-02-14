# Storage & Cache Engineer

## 존재 이유

토큰/세션은 고빈도 조회 대상이다.
잘못 설계하면 DB 폭격이 발생한다.

---

## 책임

### 1. RDB Adapter

- Source of Truth
- 만료 필드 기반 조회
- revokeByGrantId 지원

---

### 2. Redis Adapter

- TTL 기반 저장
- uid/userCode 인덱스 관리
- negative cache 지원

---

### 3. Hybrid Adapter

- write-through 전략
- cache-first read
- negative cache
- TTL margin 적용
- bestEffort fallback

---

### 4. 장애 대응

- cache 실패 시 기능 유지
- Redis 다운 → RDB fallback
- negative TTL 1~5초 유지

---

## 검증 질문

- Redis 장애 시 인증 가능한가?
- DB miss 반복 시 폭격 방지되는가?
- TTL margin이 적용되었는가?