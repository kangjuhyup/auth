---
title: 외부 Hosted Interaction UI 운영
description: client별 외부 로그인 UI 위임의 Admin 설정, 브라우저 계약, CORS·CSRF 보안과 상태 전이
---

# 외부 Hosted Interaction UI 운영

Auth는 소비자 서비스의 도메인이나 URL 계약을 알지 않습니다. 외부 Hosted UI는 화면 렌더링과 사용자 입력만 담당하고, OIDC 세션·credential 검증·MFA·동의·토큰 발급은 Auth가 소유합니다. 외부 UI는 Auth DB와 Admin API에 접근하지 않으며 비밀번호를 Account나 소비 앱 서버를 거치지 않고 Auth interaction API로 직접 제출합니다.

## Admin 설정

Admin UI의 Clients 화면에서 `External Hosted UI URL`을 설정하거나 Admin API를 사용합니다.

```http
PUT /t/{tenantCode}/admin/clients/{clientRefId}
Content-Type: application/json

{
  "externalInteractionUiUrl": "https://login.example.com/interaction"
}
```

조회 응답에는 `externalInteractionUiUrl: string | null`이 포함됩니다. `null`로 수정하면 설정을 제거하고 즉시 내장 UI fallback을 사용합니다.

허용 규칙:

- 절대 HTTPS URL만 허용
- userinfo(`user:pass@`), fragment(`#...`), wildcard host 금지
- query와 path는 허용하지만 Auth가 `tenantCode`, `uid` query를 최종 값으로 덮어씀
- HTTP는 `NODE_ENV !== production`이고 `EXTERNAL_INTERACTION_UI_ALLOW_HTTP_LOCALHOST=true`일 때 `localhost`, `127.0.0.1`, `[::1]`에만 허용

## 브라우저 부트스트랩

OIDC provider의 interaction URL은 계속 Auth 내부 경로입니다.

```text
GET https://auth.example.com/t/{tenantCode}/interaction/{uid}
```

Auth는 provider interaction cookie와 저장된 client binding을 확인한 뒤 다음 형식으로 `303` 응답을 보냅니다.

```text
Location: https://login.example.com/interaction
  ?tenantCode=acme
  &uid=interaction-uid
  #interaction_token=<short-lived-signed-token>&csrf_token=<random-token>
```

query에는 `tenantCode`, `uid`만 추가합니다. `redirect_uri`, `state`, PKCE `code_challenge`와 authorization 요청 원문은 노출하지 않습니다. 이 값들은 node-oidc-provider interaction 세션에 계속 묶여 외부 UI가 읽거나 변경할 수 없습니다.

외부 UI는 첫 렌더에서 fragment를 메모리로 읽고 즉시 `history.replaceState`로 주소창에서 제거해야 합니다. fragment credential을 로그, 분석 SDK, 오류 리포트, 저장소, cookie 또는 서버 요청에 기록하면 안 됩니다.

```ts
const page = new URL(window.location.href);
const tenantCode = page.searchParams.get('tenantCode');
const uid = page.searchParams.get('uid');
const fragment = new URLSearchParams(page.hash.slice(1));
const interactionToken = fragment.get('interaction_token');
const csrfToken = fragment.get('csrf_token');
history.replaceState(null, '', `${page.pathname}${page.search}`);
```

## Interaction API 계약

API base는 외부 UI origin이 아니라 Auth origin입니다.

```text
https://auth.example.com/t/{tenantCode}/interaction/{uid}
```

모든 `/api` 요청은 다음 옵션을 사용합니다.

```ts
const response = await fetch(`${authBase}/api/details`, {
  method: 'GET',
  mode: 'cors',
  credentials: 'include',
  headers: {
    Authorization: `Bearer ${interactionToken}`,
    'X-Interaction-CSRF': csrfToken,
  },
});
```

쓰기 요청은 `Content-Type: application/json`도 포함합니다. Auth는 설정된 client URL의 exact origin만 credentialed CORS로 허용합니다. wildcard, sibling subdomain, 다른 port 또는 다른 scheme은 허용하지 않습니다.

| 메서드 | 경로                        | 요청 body                              | 핵심 응답                                                                                     |
| ------ | --------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------- |
| `GET`  | `/api/details`              | 없음                                   | `{ uid, prompt, clientId, missingScopes, mfaRequired, idpList }`                              |
| `POST` | `/api/login`                | `{ username, password }`               | `passwordChangeRequired`, `mfaEnrollmentRequired`, `mfaRequired`, `methods` 또는 `redirectTo` |
| `POST` | `/api/password-change`      | `{ currentPassword, newPassword }`     | MFA 다음 단계 또는 `redirectTo`                                                               |
| `GET`  | `/api/mfa/webauthn-options` | 없음                                   | WebAuthn options                                                                              |
| `POST` | `/api/mfa`                  | `{ method, code?, webauthnResponse? }` | 성공 시 `redirectTo`                                                                          |
| `POST` | `/api/mfa/totp/enroll`      | 없음                                   | `{ success, secret, otpauthUrl }`                                                             |
| `POST` | `/api/mfa/totp/confirm`     | `{ code }`                             | `{ success, recoveryCodes, redirectTo? }`                                                     |
| `POST` | `/api/consent`              | 없음                                   | `{ success, redirectTo }`                                                                     |
| `POST` | `/api/abort`                | 없음                                   | `{ redirectTo }`                                                                              |

외부 IdP 버튼은 Auth가 반환한 `idpList`만 렌더링하고 전체 페이지를 `https://auth.example.com/t/{tenantCode}/interaction/{uid}/idp/{provider}`로 이동시킵니다. 임의 provider 이름을 만들지 않습니다.

## 상태 전이

```text
OIDC authorization
  -> Auth interaction bootstrap
  -> external UI details
  -> login
     -> password-change -> login completion
     -> MFA enrollment -> MFA completion
     -> MFA -> login completion
     -> login completion
  -> consent -> consent completion
  -> Auth resume URL
  -> node-oidc-provider가 검증된 redirect_uri로 이동
```

`redirectTo`는 Auth가 생성한 같은 Auth origin의 resume URL만 허용합니다. 외부 UI는 값을 조합하거나 `returnTo` 입력을 받지 않고, 성공 응답 값을 그대로 top-level navigation에 사용합니다.

## 보안 결정과 실패 처리

- 짧은 수명의 서명 access token은 tenant ID/code, client ID, uid, exact origin, CSRF hash, 브라우저 binding hash, jti, 만료를 묶습니다.
- 별도 HttpOnly browser binding과 provider interaction cookie는 외부 HTTPS UI에 필요한 `SameSite=None; Secure`로 해당 interaction 경로에만 재발급됩니다.
- Redis에는 원문 access token, CSRF, browser binding을 저장하지 않고 hash와 binding만 TTL과 함께 저장합니다.
- 같은 interaction을 다시 부트스트랩하면 이전 jti는 폐기됩니다. 종료 단계는 EVAL로 access를 먼저 원자 소비하므로 동시 재생 중 하나만 provider 완료에 진입합니다.
- 다른 tenant/client/uid/origin, 서명 변조, CSRF 또는 browser binding 불일치, 만료·재생은 `403`이며 credential 세부 이유는 노출하지 않습니다.
- `401`은 로그인/MFA credential 오류일 수 있습니다. `400`은 상태가 없거나 body가 잘못된 경우입니다. `403` 또는 만료 후에는 기존 fragment를 재사용하지 말고 소비 앱에서 OIDC authorization을 다시 시작합니다.
- 외부 UI에는 `Referrer-Policy: no-referrer`, 엄격한 CSP, HTTPS, credential 비로깅 정책을 적용해야 합니다.

## 배포와 마이그레이션

1. 새 이미지를 배포하기 전에 `Migration20260911000000`을 적용해 `client.external_interaction_ui_url` nullable column을 추가합니다.
2. `EXTERNAL_INTERACTION_ACCESS_TTL_SEC`은 60–600초, 기본 300초입니다.
3. 운영에서는 `EXTERNAL_INTERACTION_UI_ALLOW_HTTP_LOCALHOST=false`를 유지합니다.
4. 외부 UI origin에서 Auth로 credentialed CORS와 third-party cookie가 허용되는 브라우저 정책을 실제 환경에서 검증합니다. 브라우저가 third-party cookie를 차단하는 배치라면 동일 site 배포를 우선합니다.
5. client 단위로 URL을 설정하고 전체 Authorization Code + PKCE, MFA, consent, abort를 회귀 검증합니다.

설정되지 않은 client는 기존 내장 Interaction UI를 그대로 사용합니다.
