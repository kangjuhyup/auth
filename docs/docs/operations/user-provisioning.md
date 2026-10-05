---
title: 서비스 사용자 Provisioning 운영
description: 서비스 서버가 최소 권한 credential로 Auth 사용자를 만들고 표준 OIDC 로그인을 연결하는 일반 계약
---

# 서비스 사용자 Provisioning 운영

Auth는 서비스의 사용자 등록 정책 시스템이나 업무 서버를 역호출하지 않는다. 서비스 서버가 자체 사용자 등록 정책을 완료한 뒤 Auth의 tenant 범위 provisioning API를 호출한다. 사용자는 사용자 생성과 별개의 Authorization Code + PKCE 흐름으로 로그인한다.

서비스 도메인의 본인확인 결과, 고유 식별자, 연락처, 약관 원문과 회원 DTO는 Auth 요청이나 로그에 포함하지 않는다. Auth가 받는 값은 로그인 credential인 `username`과 `password`뿐이며, 응답은 OIDC 연결 키인 `subject`뿐이다.

## 최소 권한 client 준비

tenant 관리자가 `POST /t/{tenantCode}/admin/clients`로 provisioning 전용 client를 한 번 생성한다. Admin session은 배포 준비에만 사용하고 런타임 서비스 서버에는 전달하지 않는다.

```json
{
  "clientId": "<service-name>-user-provisioner",
  "secret": "<32자 이상의 secret-manager 생성값>",
  "name": "User provisioning service",
  "type": "service",
  "grantTypes": ["client_credentials"],
  "responseTypes": [],
  "tokenEndpointAuthMethod": "client_secret_basic",
  "scope": "auth.user.provision",
  "redirectUris": [],
  "postLogoutRedirectUris": []
}
```

secret은 Auth가 암호화 저장하며 생성 응답으로 되돌려주지 않는다. 호출 서비스는 별도 secret manager에 보관하고 브라우저·모바일 앱·로그에 노출하지 않는다. client는 사용자 provisioning 전용으로 만들고 일반 OIDC 로그인 client와 분리한다.

## 서비스 서버 호출 계약

### 1. service access token

```http
POST /t/{tenantCode}/oidc/token
Authorization: Basic base64(<provisioning-client-id>:<client-secret>)
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&scope=auth.user.provision
```

성공은 표준 OAuth token response다. 이 token은 최종 사용자 token이 아니며 provisioning endpoint 외에는 사용하지 않는다.

### 2. Auth 사용자 생성

```http
POST /t/{tenantCode}/provisioning/users
Authorization: Bearer <client-credentials-access-token>
Idempotency-Key: <사용자 생성 시도별 16-128자 불변 키>
Content-Type: application/json

{
  "username": "alice",
  "password": "correct horse battery staple"
}
```

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "subject": "01K..."
}
```

- `username`: 3–64자, 영문자·숫자·`_`·`.`·`-`만 허용
- `password`: 8–128자. TLS에서만 전송하며 Auth가 즉시 Argon2id 계열 hash로 저장
- `Idempotency-Key`: 16–128자, 영문자·숫자·`.`·`_`·`~`·`-`만 허용. Auth에는 SHA-256만 저장
- 동일 tenant/client/key와 동일 username 재시도는 기존 `subject`로 `201`을 반환
- 동일 key를 다른 username에 쓰거나 username이 이미 존재하면 `409`

오류 계약:

| HTTP  | 의미                                                     | 재시도                               |
| ----- | -------------------------------------------------------- | ------------------------------------ |
| `400` | body 또는 `Idempotency-Key` 형식 오류                    | 입력 수정 후 새 요청                 |
| `401` | token 누락·만료·잘못된 token·tenant 불일치·client 비활성 | 새 token 발급 후 재시도              |
| `403` | `auth.user.provision` scope 누락                         | client 설정 수정 전 재시도 금지      |
| `404` | `tenantCode`가 없음                                      | tenant 설정 확인                     |
| `409` | username 또는 idempotency binding 충돌                   | 자동으로 다른 사용자에 재바인딩 금지 |
| `5xx` | 일시적 Auth 장애                                         | 같은 `Idempotency-Key`로 제한 재시도 |

성공 감사 이벤트는 호출 client ID, tenant, 생성된 subject, correlation ID, IP와 user-agent를 기록한다. password, bearer token, client secret, `Idempotency-Key` 원문은 기록하지 않는다.

### 3. 서비스 사용자 연결과 로그인

호출 서비스는 성공한 Auth issuer와 `subject`를 자체 사용자 식별자에 연결한다. issuer는 설정된 discovery issuer(예: `https://auth.example.com/t/example/oidc`)를 사용하며 provisioning 응답에 임의 issuer를 받지 않는다.

그 뒤 앱은 기존 public client로 일반 Authorization Code + PKCE 로그인을 시작한다. `prompt=create`, `handoffId`, `/auth/signup`, hosted signup endpoint는 사용하지 않는다. 로그인 성공 시 검증된 ID token의 `(iss, sub)`가 앞서 저장한 연결과 일치해야 한다.

## Legacy hosted registration에서 마이그레이션

1. Auth 이미지를 배포하기 전에 `Migration20260910000000`을 적용한다.
2. migration은 남아 있는 `PENDING_REGISTRATION` 사용자를 안전하게 `DISABLED`로 바꾸고 legacy registration binding column을 제거한다.
3. 이전 hosted-registration backchannel의 URL, service token, timeout secret/env를 배포 설정에서 제거한다.
4. 이전 eligibility claim/complete 호출과 Auth interaction URL의 `handoffId`, `prompt=create` 조합을 서비스 서버에서 제거한다.
5. 위 provisioning 전용 service client를 만든 뒤 secret과 tenant code를 호출 서비스 서버에만 배포한다.
6. 사용자 생성 순서를 `서비스 등록 정책 완료 → Auth provisioning → (issuer, subject) 연결 → 별도 OIDC 로그인`으로 바꾼다.
7. 전환 중 `DISABLED` 처리된 미완료 사용자는 자동 활성화하지 말고 서비스 사용자 등록 상태를 확인한 뒤 새 provisioning 시도로 복구한다.

`Migration20260908000000`은 이미 배포되었을 수 있으므로 수정하지 않는다. 새 migration만 순서대로 적용한다.

## 외부 identity 회원가입

Auth는 외부 공급자 인증을 처리합니다. 서비스 회원가입 자격·본인인증·DI 중복 확인은
서비스 서버가 담당합니다. Auth는 CI/DI를 받거나 Account를 역호출하지 않습니다.

고정 로그인 콜백은 `/t/{tenantCode}/interaction/idp/kakao/callback`입니다. 카카오 앱에
이 주소와 기존 계정 연결용 `/auth/identity-links/kakao/callback?tenantCode={tenantCode}`를
등록합니다. 불투명한 state는 tenant/client/interaction/provider/가입 의도와 브라우저에
묶여 원자적으로 소비됩니다. 별도 HttpOnly 콜백 쿠키로 브라우저를 확인한 뒤 원래
UID 경로의 interaction으로 복귀합니다. 카카오 기본 scope는 `profile_nickname`이며
이메일과 `openid`는 선택입니다. CI scope는 제외하고 확인된 공급자 ID와 최소 닉네임만
사용합니다. userinfo 없이 검증하지 않은 ID token payload를 사용하는 방식은 거절합니다.

미연결 identity 또는 명시적인 `intent=signup`은 사용자 생성 없이 10분짜리 가입 티켓을
발급합니다. 보호된 details 응답에 `externalSignup: {ticket, provider, expiresAt, attemptId}`를
추가합니다. 티켓은 URL·로그·장기 브라우저 저장소에 넣지 않습니다. 서비스 서버는
`auth.user.provision` 권한으로 다음 API를 호출합니다.

- `POST /t/{tenantCode}/provisioning/external-signups/claim`은 `{ticket, clientId, attemptId}`를
  받고 `{ticketId, provider, providerSub, clientId, issuer, expiresAt}`를 반환합니다.
  확인된 `providerSub`는 서버 간 정보이며 브라우저나 로그에 노출하지 않습니다.
- 서비스 회원가입 예약 후 `/complete`에 같은 body와 `Idempotency-Key`를 전달하면
  `{issuer, subject}`를 반환합니다. 사용자와 identity는 한 트랜잭션으로 저장하고
  비밀번호 credential을 생성하지 않습니다. 같은 identity 재시도는 같은 subject를
  반환하며, 다른 identity는 같은 멱등 키를 사용할 수 없습니다.
- 보호된 `POST /t/{tenantCode}/interaction/{uid}/api/external-signup/resume`은
  `{ticket, attemptId}`와 tenant/client/UID/브라우저/완료된 identity를 검증하고 공통
  ACTIVE/MFA/세션 정책으로 로그인을 이어갑니다. 연결된 외부 로그인도 같은 정책을
  사용하며 details의 `externalLoginResult`로 MFA 처리 결과를 전달할 수 있습니다.

명시적 계정 연결은 resource 없는 표준 PKCE 로그인으로 받은 Auth의 opaque access token을
사용합니다. `/auth/identity-links/kakao/start?tenantCode={tenantCode}`를 `credentials: include`로
요청하며 공개 응답은 `{authorizationUrl}`입니다. 콜백은 코드 교환이나 identity 저장 전에
HttpOnly·SameSite=Lax 쿠키를 확인합니다. 외부 `returnTo`는 검증된 token client의
`externalInteractionUiUrl` origin에 있는 `/login`이며 `redirectUris`의 등록 값과 정확히
일치해야 합니다. 성공·오류 query는 `identityLinked`·`identityError`입니다.

실제 적용에는 카카오 앱 키·허용 scope·두 콜백, external interaction UI 등록,
`HTTP_CORS_ORIGINS`의 정확한 UI origin과 credentialed CORS, 프록시의 Set-Cookie 보존,
동일 사이트의 UI/Auth 배포가 필요합니다. 환경별 준비 상태와 secret sync/workload env
매핑 순서는 [Kubernetes 운영 계약](./kubernetes-runtime.md)을 따릅니다.
`Migration20261005000000`을 서비스 DB에 적용합니다.

연결 해제는 사용자 행을 잠근 뒤 로그인 수단을 다시 세고 삭제하므로 마지막 두 연결을
동시에 제거할 수 없습니다. 비밀번호 없는 계정의 탈퇴는 기존 비밀번호 재확인 guard가
거절합니다. 외부 재인증을 탈퇴 증명으로 사용하는 별도 계약이 필요합니다.

통합 테스트에는 명시적으로 분리한 테스트 DB·Redis를 사용합니다.

```bash
EXTERNAL_SIGNUP_TEST_DATABASE_URL='postgresql://test_user:test_password@127.0.0.1:55433/signup_test' \
EXTERNAL_SIGNUP_TEST_REDIS_URL='redis://127.0.0.1:56379/0' \
yarn service:test:unit --runTestsByPath \
  test/infrastructure/repositories/external-signup.postgresql.integration.spec.ts \
  test/infrastructure/repositories/external-signup.redis.integration.spec.ts
```

저장소의 `service/.env.e2e` 테스트 설정을 process에 읽고, 격리된 DB·Redis의
`E2E_OVERRIDE_DB_*`, `E2E_DB_NAME`, `E2E_REDIS_URL`로 덮어쓴 뒤 실행합니다.

```bash
NODE_OPTIONS=--experimental-vm-modules yarn workspace @auth/service test:e2e \
  test/e2e/user.e2e-spec.ts --runInBand -t 'resource-less PKCE|unlinked external'
```
