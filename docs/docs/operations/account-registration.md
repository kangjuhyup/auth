---
title: Account 가입 연동 운영
description: Account 본인인증 handoff와 Auth credential 등록을 운영하는 배포·장애 대응 기준
---

# Account 가입 연동 운영

Account는 본인인증, CI 폐기, DI HMAC, 중복가입, 약관과 가입자격을 소유한다. Auth는 credential, 로그인·MFA, OIDC interaction과 `PENDING_REGISTRATION` → `ACTIVE` 전이를 소유한다. CI, DI, DI HMAC, Account 연락처와 약관 원문은 Auth에 전달하거나 Auth 로그에 남기지 않는다.

## 배포 설정

Auth API 프로세스에 다음 환경 변수를 주입한다.

| 환경 변수                            | 필수   | 운영 기준                                            |
| ------------------------------------ | ------ | ---------------------------------------------------- |
| `ACCOUNT_REGISTRATION_BASE_URL`      | 예     | Account의 HTTPS origin. 자격증명·query·fragment 금지 |
| `ACCOUNT_REGISTRATION_SERVICE_TOKEN` | 예     | Account internal API 전용 Bearer service token       |
| `ACCOUNT_REGISTRATION_TIMEOUT_MS`    | 아니요 | 기본 3000ms, 허용 범위 100–10000ms                   |

`ACCOUNT_REGISTRATION_BASE_URL`이 없으면 hosted signup은 fail-closed로 `503`을 반환한다. `/auth/signup` 공개 endpoint는 설정과 무관하게 비활성화되어 `410 Gone`을 반환한다. OpenAPI에는 일반 가입 API로 오인하지 않도록 deprecated endpoint와 `410` 계약만 명시한다.

서비스 토큰은 브라우저, 모바일 앱, Interaction UI bundle에 주입하지 않는다. Auth와 Account에서만 secret manager를 통해 주입하고, 교체 시 두 서비스가 동시에 새 토큰을 수용하는 배포 순서를 사용한다.

## 호출 계약

Auth만 다음 internal API를 호출한다.

```text
POST /account/internal/v1/registration-eligibilities/claim
Authorization: Bearer <ACCOUNT_REGISTRATION_SERVICE_TOKEN>
{ handoffId, tenantId, clientId, attemptId }

POST /account/internal/v1/registration-eligibilities/complete
Authorization: Bearer <ACCOUNT_REGISTRATION_SERVICE_TOKEN>
{ registrationId, attemptId, issuer, subject }
```

claim 응답은 `{ registrationId, attemptId, status: "CLAIMED", claimExpiresAt }`, complete 응답은 `{ registrationId, status: "USED" }`다. 응답과 Auth 저장 데이터에 Account identity 원문을 추가하지 않는다.

브라우저/app은 Account 가입자격 완료 응답의 짧은 TTL `handoffId`만 진행 중인 Auth OIDC interaction URL의 `handoffId` query로 전달한다. Account는 임의 `returnTo`를 받거나 3xx redirect하지 않으므로 서비스 앱이 이미 생성된 interaction URL과 handoff를 조합한다. 실제 Account ticket은 브라우저에 노출하지 않는다.

## 상태와 재시도

정상 순서는 다음과 같다.

```text
Account ISSUED
  → claim 200 CLAIMED
  → Auth PENDING_REGISTRATION
  → complete 200 USED
  → Auth ACTIVE
  → MFA/consent/OIDC interaction 완료
```

- claim lease 만료는 `410`이며 ISSUED로 되돌리거나 handoff를 재사용하지 않는다.
- 다른 tenant/client/attempt 또는 issuer/subject binding은 `409`다.
- 같은 binding의 complete 재시도는 Account가 이미 `USED`여도 `200`이다.
- Auth는 동일 OIDC attempt의 pending binding을 먼저 재개한다. complete 응답이 유실되거나 timeout된 재시도에서 claim을 다시 소비하지 않는다.
- Account complete가 확인되기 전에는 Auth 사용자를 `ACTIVE`로 바꾸거나 OIDC interaction을 완료하지 않는다.

## 장애 대응

| Auth 응답 | 의미                                 | 운영 조치                                                         |
| --------- | ------------------------------------ | ----------------------------------------------------------------- |
| `400`     | handoff 누락 또는 잘못된 interaction | Account 완료 후 같은 interaction URL로 다시 진입                  |
| `409`     | binding 또는 Auth 상태 충돌          | 자동 재바인딩 금지, tenant/client/attempt와 감사 로그 점검        |
| `410`     | handoff/claim lease 만료             | 새 Account 본인인증과 새 handoff로 처음부터 시작                  |
| `503`     | Account 미설정, timeout, 비정상 응답 | Account 상태·네트워크·서비스 토큰을 확인한 뒤 동일 attempt 재시도 |

오류 로그에는 service token, handoffId, registrationId, issuer 전체 query, DB URL 또는 Account 응답 본문을 기록하지 않는다. `503`이 지속되면 Auth 재시작보다 Account health, TLS, DNS, token 배포 순서를 먼저 확인한다.

## 배포 체크리스트

1. `Migration20260908000000`을 적용해 registration binding column과 unique index를 생성한다.
2. Account와 Auth에 동일한 internal service token을 secret manager로 주입한다.
3. Auth에서 Account HTTPS origin에 연결 가능한지 확인한다.
4. open signup tenant와 등록된 client로 Account handoff를 발급한다.
5. claim 이후 Auth 사용자가 `PENDING_REGISTRATION`인지 확인한다.
6. complete 성공 후에만 `ACTIVE` 및 authorization code 발급이 이루어지는지 확인한다.
7. complete timeout 재시도, lease 만료 `410`, 다른 binding `409`, public `/auth/signup`의 `410`을 확인한다.

운영 지표에는 결과 코드별 claim/complete 실패율과 `PENDING_REGISTRATION` 체류 시간을 추가하되 식별자나 payload는 label로 사용하지 않는다.
