# Skill: OIDC Protocol

## Trigger
- node-oidc-provider 설정
- findAccount 콜백
- 토큰 포맷/클레임 설정
- PKCE 관련
- Grant/Interaction 처리
- JWKS 엔드포인트
- Resource Indicators

## Rules

### Provider는 Protocol Engine
node-oidc-provider가 처리하는 것 (건드리지 않음):
- Authorization code 발급 및 검증
- Token 발급/서명/검증
- PKCE 검증
- Session/Interaction 상태 관리
- redirect_uri 검증
- Grant validation

우리 코드가 처리하는 것:
- Client 등록/수정/정책 (비즈니스 생명주기)
- Key rotation 생명주기
- 커스텀 클레임 주입 (provider 콜백 통해서만)
- Audit logging
- Consent 정책 및 persistence

### Provider 설정 위치
- 반드시 `infrastructure/oidc-provider/*` 에만 위치
- Provider 콜백에서 application query port 호출 허용 (read only)
- Provider 콜백에서 application command port 호출은 최소화

### PKCE
- 모든 public client에 PKCE 필수
- S256만 허용 (plain 금지)
- PKCE 직접 구현 금지 (provider에 위임)

### Custom Claims
- provider 콜백(`claims`, `extraTokenClaims`)을 통해서만 주입
- 내부 domain 상태 노출 금지
- secret/credential 류 클레임 금지
- 결정론적이고 정책 기반으로 동작

### Key Rotation
- active key + previous key overlap window 유지
- JWKS는 overlap 기간 중 두 키 모두 노출
- Key rotation 이벤트 발생 시 JWKS 캐시 즉시 무효화

## Do
- provider에 protocol 강제 위임
- resource indicators로 JWT Access Token 발급
- redirect_uri는 provider가 검증
- PKCE S256 요구

## Don't
- PKCE 직접 구현
- 토큰 서명 파이프라인 직접 구현
- provider grant 검증 로직 우회
- HTTP(비-HTTPS) resource indicator 허용

## Checklist
- [ ] Provider 설정: infrastructure에만 위치
- [ ] 토큰 서명: provider가 처리
- [ ] PKCE: provider 강제 (S256)
- [ ] JWKS: key rotation 시 캐시 무효화됨
- [ ] Custom claims: secret 미포함
