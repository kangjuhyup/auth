# Auth UI 사용 가이드

이 문서는 `ui/` 관리자 콘솔을 사용하는 방법을 설명합니다.

## 실행

```bash
yarn workspace @auth/ui dev
```

기본 개발 설정은 `ui/.env.development`를 사용합니다.

```env
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=/api
```

서비스 API는 Vite proxy 또는 동일 origin의 `/api` 경로로 접근합니다.

## 로그인

1. 브라우저에서 UI 개발 서버에 접속합니다.
2. `/login` 화면에서 관리자 계정으로 로그인합니다.
3. 개발 모드 안내에 따라 기본 계정은 `admin / admin` 입니다.
4. 로그인에 성공하면 `/admin/tenants`로 이동합니다.

인증 실패 또는 세션 만료로 API가 `401` 또는 `403`을 반환하면 UI는 인증 상태를 비우고 `/login`으로 이동합니다.

## 공통 화면 구조

관리자 화면은 다음 구조를 사용합니다.

- 왼쪽 사이드바: 기능 메뉴
- 상단 헤더: tenant 선택, 현재 사용자, 로그아웃
- 본문: 선택한 메뉴의 관리 화면

대부분의 관리 화면은 공통적으로 다음 동작을 지원합니다.

- 목록 조회
- 페이지네이션
- 생성
- 수정
- 삭제

## Tenant 선택

상단 `Tenant` 선택 박스에서 작업할 tenant를 선택합니다.

- tenant가 선택되지 않으면 client, user 등 tenant 범위 리소스 화면에서 경고가 표시됩니다.
- 최초 진입 시 `master` tenant가 있으면 우선 선택합니다.
- `master` tenant가 없으면 목록의 첫 tenant를 선택합니다.

## Tenants

경로: `/admin/tenants`

tenant를 생성, 수정, 삭제합니다.

생성/수정 필드:

- `Code`: tenant 식별자입니다. 생성 후 수정하지 않습니다.
- `Name`: tenant 이름입니다.
- `Brand Name`: UI 또는 알림에서 사용할 브랜드명입니다.
- `Signup Policy`: `Invite Only` 또는 `Open Signup` 중 선택합니다.
- `Require Phone Verification`: 전화번호 인증 필수 여부입니다.

## Clients

경로: `/admin/clients`

OIDC/OAuth client를 관리합니다. 상단에서 tenant를 먼저 선택해야 합니다.

주요 필드:

- `Client ID`: OIDC client_id입니다. 생성 후 수정하지 않습니다.
- `Name`: client 표시 이름입니다.
- `Client Type`
  - `Public`: 브라우저/모바일 앱
  - `Confidential`: 서버 사이드 앱
  - `Service`: machine-to-machine 앱
- `Enabled`: client 활성화 여부입니다.
- `Redirect URIs`: authorization code flow callback URI입니다.
- `Post Logout Redirect URIs`: logout 이후 허용할 redirect URI입니다.
- `Grant Types`: 허용 grant type입니다.
- `Response Types`: 허용 response type입니다.
- `Allowed Scopes`: 허용 scope 문자열입니다.
- `Token Endpoint Auth Method`: token endpoint client 인증 방식입니다.

주의:

- public client는 `none` 인증 방식을 사용합니다.
- confidential client는 `client_secret_basic` 또는 `client_secret_post`를 사용합니다.
- client secret은 UI에 저장된 값을 다시 표시하지 않습니다.

### Tenant / Client 인증 정책

Tenant 기본 정책은 service API의 `/t/{tenantCode}/admin/policies`에서 조회/수정합니다. UI 코드에서는 [policyApi](/Users/kangjuhyup/Documents/auth/ui/src/features/policies/api/policyApi.ts)를 사용합니다.

조회:

```ts
const policies = await policyApi.getTenantPolicies('acme');
```

수정:

```ts
await policyApi.updateTenantPolicies('acme', {
  password: {
    minLength: 14,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSymbol: true,
    preventReuseCount: 10,
    expiresInDays: 90,
    lockoutFailureThreshold: 5,
    lockoutDurationSec: 900,
  },
  mfa: {
    required: true,
    adminRequired: true,
  },
  allowedIdp: {
    providerKeys: ['google', 'okta-workforce'],
  },
  session: {
    maxAgeSec: 28800,
    requireAuthTime: true,
    reauthenticationIntervalSec: 3600,
  },
  refreshToken: {
    ttlSec: 1209600,
    rotationEnabled: true,
    reuseAction: 'revoke_grant',
  },
  signup: {
    mode: 'invite',
    allowedEmailDomains: ['example.com'],
  },
});
```

Client별 override는 `/t/{tenantCode}/admin/clients/{clientId}/auth-policy`에서 조회/수정합니다. UI 코드에서는 [clientApi](/Users/kangjuhyup/Documents/auth/ui/src/features/clients/api/clientApi.ts)의 `getAuthPolicy`, `updateAuthPolicy`를 사용합니다.

```ts
const policy = await clientApi.getAuthPolicy('acme', 'client-ref-id');

await clientApi.updateAuthPolicy('acme', 'client-ref-id', {
  mfaRequired: true,
  allowedIdpProviderKeys: ['okta-workforce'],
  maxSessionDurationSec: 3600,
  requireAuthTime: true,
  reauthenticationIntervalSec: 1800,
  refreshTokenRotationEnabled: true,
  refreshTokenReuseAction: 'revoke_grant',
});
```

우선순위:

- Tenant 정책은 기본값입니다.
- Client 정책에 값이 있으면 `allowedIdpProviderKeys`, `maxSessionDurationSec`, `reauthenticationIntervalSec`, client refresh token TTL이 우선합니다.
- 보안상 tenant MFA 필수 또는 `requireAuthTime`이 켜져 있으면 client에서 끌 수 없습니다.
- client auth policy 응답의 `effective` 필드에서 실제 적용값을 확인합니다.

## Identity Providers

경로: `/admin/identity-providers`

외부 IdP를 tenant에 연결합니다. OAuth 2.0과 SAML 2.0을 지원합니다.

공통 필드:

- `Provider key`: provider 식별자입니다. 예: `google`, `okta_workforce`
- `Protocol`: `OAuth 2.0` 또는 `SAML 2.0`
- `Display name`: 로그인 화면에 표시할 이름입니다.
- `Client ID` 또는 `SP issuer / entity ID`
- `Redirect URI` 또는 `ACS callback URL`
- `Enabled`: IdP 활성화 여부입니다.

OAuth 2.0 필드:

- `Client secret`: 생성 시 필수입니다. 수정 시 비워두면 기존 값을 유지합니다.
- `OAuth endpoints override`: 커스텀 IdP를 사용할 때 authorization/token/userinfo endpoint 등을 JSON으로 입력합니다.

SAML 2.0 필드:

- `IdP SSO URL`
- `IdP certificate`
- `IdP issuer`
- `Audience`
- `NameID format`
- `Requested AuthnContext`
- `Subject attribute`
- `Email attribute`
- `Accepted clock skew`
- `Max assertion age`
- `Request ID expiration`
- `Require signed assertions`
- `Require signed response`
- `Force re-authentication`
- `Disable requested AuthnContext`

SAML 인증서는 PEM 형식으로 입력합니다. 여러 인증서를 넣을 때는 빈 줄로 구분합니다.

## Roles

경로: `/admin/roles`

역할을 생성, 수정, 삭제합니다.

필드:

- `Code`: 역할 식별자입니다. 예: `admin`
- `Name`: 역할 이름입니다.
- `Description`: 역할 설명입니다.

## Groups

경로: `/admin/groups`

그룹을 생성, 수정, 삭제하고 그룹에 역할을 부여합니다.

필드:

- `Code`: 그룹 식별자입니다. 예: `engineering`
- `Name`: 그룹 이름입니다.
- `Parent Group`: 상위 그룹입니다.

그룹 목록의 역할 관리 액션에서 그룹에 역할을 추가하거나 제거할 수 있습니다.

## Users

경로: `/admin/users`

사용자를 생성, 수정, 삭제하고 사용자 역할과 consent를 조회합니다.

생성/수정 필드:

- `Username`: 사용자 이름입니다. 생성 후 수정하지 않습니다.
- `Password`: 생성 시 입력합니다.
- `Email`: 이메일입니다.
- `Phone`: 전화번호입니다.
- `Status`
  - `ACTIVE`
  - `LOCKED`
  - `DISABLED`

목록 액션:

- 역할 아이콘: 사용자 역할 관리
- audit 아이콘: 사용자 consent 조회
- 수정 아이콘: 사용자 수정
- 삭제 아이콘: 사용자 삭제

### 사용자 역할 관리

사용자 목록에서 역할 아이콘을 클릭하면 역할 관리 모달이 열립니다.

- 현재 부여된 역할을 확인합니다.
- 새 역할을 추가합니다.
- 기존 역할을 제거합니다.

### 사용자 Consent 조회

사용자 목록에서 audit 아이콘을 클릭하면 consent 모달이 열립니다.

- `Current`: 현재 활성 consent
- `History`: revoked consent를 포함한 이력

각 consent 행을 펼치면 client와 scope 기반 상세 표시를 확인할 수 있습니다.

## Security

경로: `/admin/security`

현재 로그인한 사용자의 계정 보안 설정을 관리합니다.

### Profile status

현재 사용자 이름과 계정 상태를 확인합니다.

### Contact verification

이메일 또는 전화번호 인증을 진행합니다.

1. `Request` 버튼으로 인증 코드를 요청합니다.
2. 받은 인증 코드를 입력합니다.
3. `Verify` 버튼을 누릅니다.

### Authenticator app

TOTP 인증 앱을 등록하거나 해제합니다.

등록:

1. `Start enrollment`를 누릅니다.
2. 표시된 secret 또는 OTP auth URL을 인증 앱에 등록합니다.
3. 인증 앱의 6자리 코드를 입력합니다.
4. `Confirm`을 누릅니다.
5. 발급된 recovery code를 안전한 곳에 보관합니다.

해제:

1. `Disable`을 누릅니다.
2. 확인 팝업에서 해제를 승인합니다.

주의:

- recovery code는 발급 직후에만 표시됩니다.
- recovery code 원문을 서버나 로그에 저장하지 않습니다.

### Connected identity providers

현재 계정에 연결된 외부 IdP 목록을 확인합니다.

- provider 이름
- 연결 이메일
- 연결 날짜

`Unlink`를 누르면 해당 IdP 연결을 해제합니다.

## 로그아웃

상단 우측 `Logout` 버튼을 누릅니다.

로그아웃은 서버 세션 종료 API를 호출한 뒤 UI 인증 상태를 비우고 `/login`으로 이동합니다.

## 운영 시 주의사항

- UI에는 client secret, token, recovery code 원문을 지속 저장하지 않습니다.
- OIDC authorization/token 흐름은 UI에서 직접 구현하지 않고 backend endpoint에 위임합니다.
- 서버 데이터는 TanStack Query 캐시로 관리합니다.
- Zustand는 tenant 선택, modal open 상태, 사이드바 접힘 상태 같은 UI 상태에만 사용합니다.
- API 오류 메시지는 사용자에게 표시하되 token/secret 값을 포함하지 않습니다.
