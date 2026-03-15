# Skill: Security (최우선)

## Trigger
- 토큰 로직
- Key rotation
- Consent 처리
- Client 검증
- Authentication 흐름
- Multi-tenant 바인딩
- Rate limiting / Abuse protection
- 보안에 영향을 주는 모든 변경

## Rules

### 기본 원칙
Security correctness > Convenience.
보안을 약화시키는 요청은 거부하고 안전한 대안을 제시한다.

### Multi-Tenant 바인딩
- 모든 토큰/리소스는 tenantId에 바인딩
- cross-tenant 접근 차단
- resource indicator에 tenant origin 포함

### Token / Key 무결성
- 평문 secret/credential 저장 금지
- raw key material을 domain/application에서 다루지 않음
- token 로그 금지 (authorization code, refresh token 포함)

### Redirect URI / Client 검증
- redirect_uri는 provider가 검증 (직접 구현 금지)
- HTTP redirect_uri는 production에서 금지 (localhost 개발 환경 제외)

### Replay 방지
- provider 내장 메커니즘 사용
- refresh token reuse 감지 시 → audit event emit + 정책에 따라 revoke

### Rate Limiting / Abuse Protection
- token endpoint throttling 필수
- authorization endpoint brute-force mitigation 필수
- 카운터는 non-authoritative (short TTL)
- 캐시 카운터로 domain invariant 결정 금지

### 보안 이벤트 로깅 (필수, secret 제외)
로그 포함 대상:
- client 인증 실패 (clientId, reason)
- key rotation (kid, correlationId)
- consent 변경
- replay/reuse 감지 신호
- admin 작업 (client/key/policy aggregate)

로그 금지:
- tokens, authorization codes, secrets, raw key material

모든 로그에 포함:
- correlationId (또는 requestId)
- clientId (관련 시)
- userId (이미 인증된 경우에만)

## Do
- tenant 바인딩 검증
- HTTPS 강제 (production)
- 의심 이벤트 로깅
- replay 방어

## Don't
- 보안 검증 약화
- secret/token 로깅
- HTTP resource indicator 허용 (production)
- 캐시 카운터로 invariant 결정

## Checklist
- [ ] Tenant binding 검증됨
- [ ] HTTPS 강제됨 (production)
- [ ] secret/token 로그 없음
- [ ] Replay 방어됨
- [ ] 보안 이벤트 로깅 포함됨
