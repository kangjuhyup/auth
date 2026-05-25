---
title: Identity Providers
---

# Identity Providers

경로: `/admin/identity-providers`

외부 IdP를 tenant에 연결합니다. OAuth 2.0과 SAML 2.0을 지원합니다.

## 공통 필드

| 필드 | 설명 |
| --- | --- |
| `Provider key` | provider 식별자입니다. 예: `google`, `okta_workforce` |
| `Protocol` | `OAuth 2.0` 또는 `SAML 2.0` |
| `Display name` | 로그인 화면에 표시할 이름입니다. |
| `Enabled` | IdP 활성화 여부입니다. |

## OAuth 2.0 필드

- `Client ID`
- `Client secret`
- authorization endpoint
- token endpoint
- userinfo endpoint

:::warning
OAuth client secret은 생성 시 필수입니다. 수정 시 비워두면 기존 값을 유지합니다.
:::

## SAML 2.0 필드

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

SAML 인증서는 PEM 형식으로 입력합니다. 여러 인증서를 넣을 때는 빈 줄로 구분합니다.
