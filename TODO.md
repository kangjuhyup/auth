# TODO

OIDC Authorization Server를 엔터프라이즈 인증 서비스로 확장하기 위한 작업 목록입니다.

## P0. Audit Log 고도화

목표: 보안 사고 대응, 운영 추적, 관리자 작업 이력을 신뢰할 수 있게 남긴다.

- [ ] Admin 작업 전반 감사 이벤트 기록
  - [ ] tenant 생성/수정/삭제
  - [ ] client 생성/수정/삭제
  - [ ] IdP 생성/수정/삭제
  - [ ] 정책 변경
  - [ ] 사용자 상태 변경
- [ ] Client 인증 실패 audit 기록
  - [ ] invalid_client
  - [ ] client_secret 불일치
  - [ ] 비활성 client 접근
- [ ] Key rotation audit 기록
- [x] Refresh token reuse audit 기록
- [ ] Suspicious login audit 기록
  - [ ] 실패 횟수 급증
  - [ ] 새 기기/새 위치
  - [ ] 비정상 시간대 접근
- [ ] Audit 검색/필터 API 확장
  - [ ] 기간
  - [ ] tenantId
  - [ ] userId
  - [ ] clientId
  - [ ] action
  - [ ] severity
  - [ ] correlationId
- [ ] Audit 검색/필터 UI 추가
- [ ] 테스트
  - [ ] command handler audit 기록 단위 테스트
  - [ ] OIDC provider 이벤트 audit 테스트
  - [ ] audit query 필터 테스트

## P1. Tenant / Client 정책 확장

목표: tenant 기본 정책과 client별 override 정책을 분리해서 운영자가 인증 정책을 제어할 수 있게 한다.

- [ ] Password policy
  - [ ] 최소 길이
  - [ ] 복잡도
  - [ ] 비밀번호 재사용 금지
  - [ ] 비밀번호 만료 정책
  - [ ] 실패 횟수 기반 잠금 정책
- [ ] MFA required policy
  - [ ] tenant 전체 MFA 필수
  - [ ] admin 사용자 MFA 필수
  - [ ] client별 MFA 필수 override
- [ ] Allowed IdP policy
  - [ ] tenant별 허용 IdP 제한
  - [ ] client별 허용 IdP override
- [ ] Session policy
  - [ ] session max age
  - [ ] require auth_time
  - [ ] re-authentication interval
- [x] Client별 refresh token rotation 정책
- [x] Client별 refresh token TTL 정책
- [ ] Tenant 기본 refresh token TTL 정책 UI/API 정리
- [ ] Signup / invite policy
  - [ ] 공개 가입
  - [ ] 초대 기반 가입
  - [ ] 허용 이메일 도메인
- [ ] 테스트
  - [ ] tenant 정책 도메인 테스트
  - [ ] client override 우선순위 테스트
  - [ ] policy command/query 테스트

## P1. Recovery Code 운영

목표: MFA 수단 분실 시 안전한 복구 경로를 제공한다.

- [ ] Recovery code 재발급
- [ ] 재발급 시 기존 recovery code 폐기
- [ ] 사용된 코드 표시
- [ ] 남은 코드 개수 표시
- [ ] 남은 코드 부족 시 알림 이벤트 생성
- [ ] Recovery code 원문은 최초 발급 시에만 표시
- [ ] Recovery code는 해시로만 저장
- [ ] Audit 기록
  - [ ] recovery code 발급
  - [ ] recovery code 재발급
  - [ ] recovery code 사용
- [ ] 테스트
  - [ ] recovery code 재발급 테스트
  - [ ] 사용된 코드 재사용 차단 테스트
  - [ ] 부족 알림 이벤트 테스트

## P2. WebAuthn / Passkey 등록 UX

목표: phishing-resistant MFA를 사용자 계정 보안 기능으로 제공한다.

- [ ] WebAuthn 등록 시작 API
- [ ] WebAuthn 등록 완료 API
- [ ] 등록된 passkey 목록 조회
- [ ] passkey 이름 변경
- [ ] passkey 삭제/비활성화
- [ ] passkey 기반 MFA 검증 UX
- [ ] 사용자 보안 설정 UI 추가
- [ ] Audit 기록
  - [ ] passkey 등록
  - [ ] passkey 삭제
  - [ ] passkey 인증 실패
- [ ] 테스트
  - [ ] registration challenge 생성 테스트
  - [ ] registration response 검증 테스트
  - [ ] credential 삭제 테스트
  - [ ] UI interaction 테스트

## P2. 운영 / 관측성

목표: production 장애 분석과 용량 관리를 가능하게 한다.

- [ ] Health / readiness 분리
  - [ ] health: 프로세스 상태
  - [ ] readiness: DB, Redis, JWKS, OIDC provider 준비 상태
- [ ] OIDC provider별 metrics
  - [ ] provider 생성 수
  - [ ] provider cache hit/miss
  - [ ] token endpoint latency
- [ ] Login / token / error counters
  - [ ] login success/failure
  - [ ] token issued
  - [ ] refresh token exchange
  - [ ] invalid_grant
  - [ ] invalid_client
- [ ] Audit correlationId 전파
  - [ ] HTTP request
  - [ ] command handler
  - [ ] provider event
  - [ ] audit log
- [ ] Structured logging
  - [ ] JSON 로그
  - [ ] tenantId/clientId/userId/correlationId 포함
  - [ ] token/secret 마스킹
- [ ] 테스트
  - [ ] readiness 상태 테스트
  - [ ] metrics counter 테스트
  - [ ] correlationId 전파 테스트

## P3. 관리자 RBAC 고도화

목표: SUPER_ADMIN 중심 권한을 tenant 운영 역할로 분리한다.

- [ ] 관리자 역할 정의
  - [ ] SUPER_ADMIN
  - [ ] TENANT_ADMIN
  - [ ] CLIENT_ADMIN
  - [ ] USER_ADMIN
  - [ ] AUDIT_VIEWER
  - [ ] KEY_ADMIN
  - [ ] POLICY_ADMIN
- [ ] 관리자 권한 검사 정책 추가
- [ ] tenant 경계 검증 강화
- [ ] controller별 필요한 관리자 권한 선언
- [ ] 관리자 권한 변경 audit 기록
- [ ] 테스트
  - [ ] role별 허용/차단 테스트
  - [ ] tenant 경계 차단 테스트
  - [ ] audit viewer 읽기 전용 테스트

## P4. SCIM / User Provisioning

목표: Okta, Azure AD, Google Workspace 등 엔터프라이즈 디렉터리와 사용자 생명주기를 동기화한다.

- [ ] SCIM tenant 설정
- [ ] SCIM bearer token 발급/폐기
- [ ] `/scim/v2/Users`
  - [ ] 사용자 생성
  - [ ] 사용자 조회
  - [ ] 사용자 수정
  - [ ] 사용자 비활성화
- [ ] `/scim/v2/Groups`
  - [ ] 그룹 생성
  - [ ] 그룹 조회
  - [ ] 그룹 수정
  - [ ] 그룹 삭제
  - [ ] 그룹 멤버 동기화
- [ ] 외부 ID 매핑
- [ ] Provisioning audit 기록
- [ ] 테스트
  - [ ] SCIM Users API e2e
  - [ ] SCIM Groups API e2e
  - [ ] 외부 ID idempotency 테스트
  - [ ] 비활성화 동기화 테스트

## 작업 원칙

- [ ] 기능 단위마다 테스트를 먼저 추가하거나 함께 추가한다.
- [ ] 작업 완료 후 회귀 테스트를 통과시킨다.
- [ ] 커밋 메시지는 한글로 작성한다.
- [ ] 보안 이벤트에는 token, secret, recovery code 원문을 기록하지 않는다.
- [ ] controller에는 비즈니스 로직을 넣지 않는다.
- [ ] application handler를 우회하지 않는다.
