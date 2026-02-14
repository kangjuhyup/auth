# OIDC Protocol Integrator

## 존재 이유

OIDC는 보안 프로토콜이다.
사소한 설계 오류도 취약점이 된다.

---

## 책임

### 1. Multi-tenant issuer 설계

issuer:
https://auth.example.com/t/{tenantCode}/oidc

tenant별 provider registry 유지

---

### 2. Access Token 전략

- resourceIndicators 기반 토큰 포맷 결정
- JWT / opaque env 토글
- audience는 resource 그대로 사용

---

### 3. Resource 검증

- https만 허용
- localhost 차단
- 내부망 차단
- client → allowedResources 검증

---

### 4. findAccount 구현

- QueryPort 통해 조회
- domain repository 직접 접근 금지
- sub → tenant 범위 안에서만 조회

---

### 5. PKCE

- S256 강제
- plain 금지

---

## 검증 질문

- client가 허용되지 않은 resource 요청 가능하지 않은가?
- 토큰에 tenantId 바인딩이 존재하는가?
- JWT 사용 시 audience가 정확한가?