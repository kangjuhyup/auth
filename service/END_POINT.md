# OIDC 인증/인가 서버 – 엔드포인트 명세

본 문서는 OIDC 인증/인가 서버에서 제공해야 하는
모든 공개 및 관리자 엔드포인트를 정의한다.

프로토콜 엔진: node-oidc-provider  
보안은 편의보다 항상 우선한다.

---

# 1. OIDC 핵심 엔드포인트

다음 엔드포인트는 OpenID Connect Core 표준에 의해 정의된다.

---

## 1.1 Authorization Endpoint

GET /authorize

목적:
- 사용자 인증 시작
- Authorization Code 발급

필수 파라미터:
- client_id
- redirect_uri
- response_type=code
- scope (openid 포함 필수)
- state
- nonce
- code_challenge
- code_challenge_method=S256

보안 요구사항:
- redirect_uri는 정확히 일치해야 함 (부분 일치 금지)
- PKCE 필수 (S256만 허용)
- state 필수 및 검증
- nonce 필수 (OIDC)
- 오픈 리다이렉트 방지
- 클라이언트 엄격 검증
- 전체 쿼리 파라미터 로그 금지

오류 처리:
- OAuth 표준 에러 코드 반환
- 내부 스택 트레이스 노출 금지

---

## 1.2 Token Endpoint

POST /token

목적:
- Authorization Code → 토큰 교환
- Refresh Token → 새로운 토큰 발급

지원 grant_type:
- authorization_code
- refresh_token

보안 요구사항:
- Confidential Client는 client 인증 필수
- Public Client는 PKCE 필수
- Authorization Code 1회성 사용
- Authorization Code 최대 5분 이내 만료
- Refresh Token Rotation 필수
- Refresh Token 재사용 감지 필수
- 토큰/비밀 로그 금지

응답:
- access_token
- id_token
- refresh_token (해당 시)
- expires_in
- token_type=Bearer

---

## 1.3 Discovery Endpoint

GET /.well-known/openid-configuration

목적:
- OIDC 클라이언트 자동 설정용 메타데이터 제공

필수 포함 항목:
- issuer
- authorization_endpoint
- token_endpoint
- jwks_uri
- scopes_supported
- response_types_supported
- grant_types_supported

보안:
- 공개 엔드포인트
- 짧은 TTL 캐시 허용
- 설정 변경 시 캐시 무효화

---

## 1.4 JWKS Endpoint

GET /.well-known/jwks.json

목적:
- 토큰 서명 검증용 공개키 제공

요구사항:
- 활성 서명 키 포함
- 이전 키 overlap 유지
- Private Key 절대 노출 금지
- kid 필수
- TTL 캐시 허용
- Key Rotation 시 캐시 무효화

---

## 1.5 UserInfo Endpoint

GET /userinfo

목적:
- Access Token 기반 사용자 정보 제공

보안 요구사항:
- Access Token 검증 필수
- scope 기반 claim 필터링
- 최소 정보만 반환
- 내부 시스템 정보 노출 금지
- 토큰 로그 금지

---

# 2. 운영 엔드포인트

---

## 2.1 End Session Endpoint (로그아웃)

GET /end-session

목적:
- 세션 종료
- RP 로그아웃 처리

보안:
- id_token_hint 검증
- post_logout_redirect_uri 검증
- 오픈 리다이렉트 방지

---

## 2.2 Token Revocation Endpoint

POST /revoke

목적:
- Access Token 또는 Refresh Token 폐기

보안:
- 클라이언트 인증 필수
- Refresh Token Family 전체 폐기 지원
- 감사 로그 기록

---

## 2.3 Token Introspection Endpoint

POST /introspect

목적:
- 리소스 서버용 토큰 유효성 검증

보안:
- 클라이언트 인증 필수
- active/inactive 상태만 반환
- 민감 정보 노출 금지

---

## 2.4 Pushed Authorization Request (PAR)

POST /par

목적:
- 민감한 authorization 요청 파라미터를 사전 등록

보안:
- 클라이언트 인증 필수
- 짧은 만료 시간
- 금융권/고보안 환경에서 권장

---

# 3. 관리자 엔드포인트

다음 엔드포인트는 OIDC 표준에는 없지만 운영상 필요하다.

공통 보안 요구사항:
- 강력한 인증 필요
- RBAC 권한 검사
- 모든 변경사항 감사 로그 기록
- HTTPS 필수
- 비밀 정보 응답 금지

---

## 3.1 Client 관리

GET    /admin/clients
POST   /admin/clients
PUT    /admin/clients/:id
DELETE /admin/clients/:id

보안:
- redirect_uri 엄격 검증
- secret은 해시 저장
- grant_type 검증
- 변경 이벤트 기록

---

## 3.2 Key 관리

GET  /admin/keys
POST /admin/keys/rotate

보안:
- 키 로테이션 시 overlap 유지
- 기존 키 즉시 삭제 금지
- KeyRotated 이벤트 기록
- JWKS 캐시 무효화

---

## 3.3 정책 관리

GET  /admin/policies
PUT  /admin/policies

보안:
- 정책 변경 감사 로그 기록
- PKCE 강제 여부 검증

---

## 3.4 감사 로그

GET /admin/audit-logs

보안:
- 읽기 전용
- 역할 기반 접근 제한
- 토큰/비밀 정보 포함 금지

## 3.5 Tenant 관리

GET    /admin/tenants
GET    /admin/tenants/:id
POST   /admin/tenants
PUT    /admin/tenants/:id
DELETE /admin/tenants/:id

보안:
- 테넌트 생성/삭제는 최고 관리자만 가능
- 테넌트 코드는 생성 후 변경 불가
- 삭제 시 하위 리소스 존재 여부 확인
- 변경 이벤트 기록

---

## 3.6 User 관리

GET    /admin/users
GET    /admin/users/:id
POST   /admin/users
PUT    /admin/users/:id
DELETE /admin/users/:id

보안:
- 비밀번호는 해시 저장, 응답에 포함 금지
- 사용자 상태 변경 (ACTIVE/LOCKED/DISABLED) 감사 로그 기록
- 이메일/전화번호 중복 검증
- 개인정보 최소 노출

---

## 3.7 Role 관리

GET    /admin/roles
GET    /admin/roles/:id
POST   /admin/roles
PUT    /admin/roles/:id
DELETE /admin/roles/:id

보안:
- 역할 코드는 테넌트 내 유일
- 역할 삭제 시 할당된 사용자/그룹 확인
- 역할 상속 순환 참조 방지
- 변경 이벤트 기록

---

## 3.8 Permission 관리

GET    /admin/permissions
GET    /admin/permissions/:id
POST   /admin/permissions
PUT    /admin/permissions/:id
DELETE /admin/permissions/:id

보안:
- 퍼미션 코드는 테넌트 내 유일
- 삭제 시 역할 연관 확인
- 변경 이벤트 기록

---

## 3.9 Group 관리

GET    /admin/groups
GET    /admin/groups/:id
POST   /admin/groups
PUT    /admin/groups/:id
DELETE /admin/groups/:id

보안:
- 그룹 코드는 테넌트 내 유일
- 계층 구조 순환 참조 방지
- 삭제 시 하위 그룹 존재 여부 확인
- 변경 이벤트 기록

---

# 4. 사용자 셀프서비스 엔드포인트

다음 엔드포인트는 인증된 사용자가 직접 사용하는 기능이다.

---

## 4.1 회원가입

POST /auth/signup

목적:
- 새로운 사용자 계정 생성

필수 파라미터:
- tenant_code
- username
- password
- email (선택)

보안 요구사항:
- 테넌트의 signup_policy 확인 (open/invite)
- invite 정책 시 초대 토큰 검증 필수
- 비밀번호 강도 검증
- 비밀번호는 해시 저장
- username/email 중복 검증
- Rate Limiting 적용
- 감사 로그 기록

---

## 4.2 회원탈퇴

POST /auth/withdraw

목적:
- 사용자 자발적 계정 삭제/비활성화

보안 요구사항:
- 인증 필수
- 비밀번호 재확인
- 관련 세션/토큰 전체 폐기
- 동의 기록 철회
- 감사 로그 기록
- 즉시 삭제 또는 DISABLED 처리 후 유예 기간

---

## 4.3 비밀번호 변경

PUT /auth/password

목적:
- 인증된 사용자의 비밀번호 변경

필수 파라미터:
- current_password
- new_password

보안 요구사항:
- 인증 필수
- 현재 비밀번호 검증
- 새 비밀번호 강도 검증
- 기존 비밀번호와 동일 여부 확인
- 변경 후 기존 세션 유지 또는 재인증
- 감사 로그 기록

---

## 4.4 비밀번호 초기화 요청

POST /auth/password/reset-request

목적:
- 비밀번호 분실 시 초기화 링크 발송

필수 파라미터:
- tenant_code
- email

보안 요구사항:
- 사용자 존재 여부 노출 금지 (항상 동일 응답)
- Rate Limiting 강력 적용
- 초기화 토큰은 짧은 TTL (15분 이내)
- 감사 로그 기록

---

## 4.5 비밀번호 초기화

POST /auth/password/reset

목적:
- 토큰 기반 비밀번호 재설정

필수 파라미터:
- token
- new_password

보안 요구사항:
- 토큰 1회성 사용
- 토큰 만료 검증
- 새 비밀번호 강도 검증
- 기존 세션/토큰 전체 폐기
- 감사 로그 기록

---

## 4.6 동의 목록 조회

GET /auth/consents

목적:
- 사용자가 부여한 클라이언트별 동의 목록 조회

보안 요구사항:
- 인증 필수
- 자신의 동의만 조회 가능
- 민감 정보 노출 금지

---

## 4.7 동의 철회

DELETE /auth/consents/:clientId

목적:
- 특정 클라이언트에 대한 동의 철회

보안 요구사항:
- 인증 필수
- 자신의 동의만 철회 가능
- 관련 Refresh Token 폐기
- 감사 로그 기록

---

## 4.8 프로필 조회

GET /auth/profile

목적:
- 인증된 사용자 본인 프로필 조회

보안 요구사항:
- 인증 필수
- 민감 정보 (비밀번호 해시 등) 노출 금지

---

## 4.9 프로필 수정

PUT /auth/profile

목적:
- 인증된 사용자 본인 프로필 수정

수정 가능 필드:
- email
- phone

보안 요구사항:
- 인증 필수
- email/phone 변경 시 인증 절차 필요 (추후)
- 중복 검증
- 감사 로그 기록

---

# 5. 전역 보안 요구사항

모든 엔드포인트는 다음을 준수해야 한다:

- HTTPS 강제
- HSTS 적용
- CSRF 방어 (필요 시)
- Rate Limiting 적용
- Correlation ID 로깅
- 민감 정보 로그 금지
- 에러 메시지에 내부 구현 정보 노출 금지

---

# 6. 변경 금지 규칙

다음과 같은 설정 변경은 허용되지 않는다:

- PKCE 비활성화
- redirect_uri 부분 매칭 허용
- Key overlap 제거
- Refresh Token Rotation 비활성화
- 민감 claim 과도 노출
