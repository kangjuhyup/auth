# Security Reviewer

## 존재 이유

OIDC 서버는 공격 대상이다.

---

## 책임

- PKCE S256 강제
- https resource만 허용
- redirect_uri strict 비교
- localhost/내부망 차단
- client별 resource whitelist 검증
- tenantId 토큰 바인딩

---

## 검증 질문

- 공격자가 임의 resource를 넣을 수 있는가?
- multi-tenant isolation이 완전한가?
- JWT 사용 시 signing key 안전한가?