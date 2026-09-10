---
title: 서비스 사용자 Provisioning 운영
description: 소비자 서비스가 최소 권한 credential로 Auth 계정을 만들고 표준 OIDC 로그인을 연결하는 범용 계약
---

# 서비스 사용자 Provisioning 운영

Auth는 소비자 서비스나 외부 가입자격 시스템을 역호출하지 않습니다. 소비자 서비스가 자체 본인인증, 중복 가입, 약관과 가입 자격을 완료한 뒤 Auth의 tenant 범위 provisioning API를 호출합니다. 사용자는 계정 생성과 별개의 Authorization Code + PKCE 흐름으로 로그인합니다.

CI, DI, 본인인증 식별자/HMAC, 연락처, 약관 원문과 서비스 회원 DTO는 Auth 요청이나 로그에 포함하지 않습니다. Auth가 받는 값은 로그인 credential인 `username`과 `password`뿐이며, 응답은 OIDC 연결 키인 `subject`뿐입니다.

## 최소 권한 client 준비

tenant 관리자가 `POST /t/{tenantCode}/admin/clients`로 전용 client를 한 번 생성합니다. Admin session은 배포 준비에만 사용하고 런타임 소비자 서비스에는 전달하지 않습니다.

```json
{
  "clientId": "service-user-provisioner",
  "secret": "<32자 이상의 secret-manager 생성값>",
  "name": "Service user provisioner",
  "type": "service",
  "grantTypes": ["client_credentials"],
  "responseTypes": [],
  "tokenEndpointAuthMethod": "client_secret_basic",
  "scope": "auth.user.provision",
  "redirectUris": [],
  "postLogoutRedirectUris": []
}
```

secret은 Auth가 암호화 저장하며 생성 응답으로 되돌려주지 않습니다. 소비자 서비스는 별도 secret manager에 보관하고 브라우저·모바일 앱·로그에 노출하지 않습니다. client는 가입 처리 전용으로 만들고 일반 OIDC 로그인 client와 분리합니다.

## 소비자 서비스 호출 계약

### 1. service access token

```http
POST /t/{tenantCode}/oidc/token
Authorization: Basic base64(service-user-provisioner:<client-secret>)
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&scope=auth.user.provision
```

성공은 표준 OAuth token response입니다. 이 token은 최종 사용자 token이 아니며 provisioning endpoint 외에는 사용하지 않습니다.

### 2. Auth 사용자 생성

```http
POST /t/{tenantCode}/provisioning/users
Authorization: Bearer <client-credentials-access-token>
Idempotency-Key: <서비스 가입 시도별 16-128자 불변 키>
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

성공 감사 이벤트는 호출 client ID, tenant, 생성된 subject, correlation ID, IP와 user-agent를 기록합니다. password, bearer token, client secret, `Idempotency-Key` 원문은 기록하지 않습니다.

### 3. 서비스 회원 연결과 로그인

소비자 서비스는 성공한 Auth issuer와 `subject`를 자체 회원에 연결합니다. issuer는 설정된 discovery issuer(예: `https://auth.example.com/t/acme/oidc`)를 사용하며 provisioning 응답에 임의 issuer를 받지 않습니다.

그 뒤 앱은 기존 public client로 일반 Authorization Code + PKCE 로그인을 시작합니다. 가입용 prompt나 handoff 파라미터, 비표준 public signup endpoint를 사용하지 않습니다. 로그인 성공 시 검증된 ID token의 `(iss, sub)`가 앞서 저장한 연결과 일치해야 합니다.

## 이전 역호출형 registration에서 마이그레이션

1. Auth 이미지를 배포하기 전에 `Migration20260910000000`을 적용합니다.
2. migration은 남아 있는 `PENDING_REGISTRATION` 사용자를 안전하게 `DISABLED`로 바꾸고 legacy registration binding column을 제거합니다.
3. 기존 registration 역호출용 base URL, service token, timeout 환경변수를 배포 설정에서 제거합니다.
4. 외부 가입자격 claim/complete 호출과 Auth interaction URL의 가입용 handoff 조합을 소비자 서비스에서 제거합니다.
5. 위 전용 service client를 만든 뒤 secret과 tenant code를 소비자 서비스 서버에만 배포합니다.
6. 가입 완료 순서를 `서비스 정책 완료 → Auth provisioning → (issuer, subject) 저장 → 별도 OIDC 로그인`으로 바꿉니다.
7. 전환 중 `DISABLED` 처리된 미완료 사용자는 자동 활성화하지 말고 서비스 가입 상태를 확인한 뒤 새 provisioning 시도로 복구합니다.

`Migration20260908000000`은 이미 배포되었을 수 있으므로 수정하지 않습니다. 새 migration만 순서대로 적용합니다.
