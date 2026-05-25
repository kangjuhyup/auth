---
title: Identity Providers
---

# Identity Providers

경로: `/admin/identity-providers`

외부 IdP를 tenant에 연결합니다. OAuth 2.0과 SAML 2.0을 지원합니다. 개념 설명은 [IdP 개요](../concepts/idp.md)를 참고하세요.

## 공통 필드

| 필드           | 설명                                                  |
| -------------- | ----------------------------------------------------- |
| `Provider key` | provider 식별자입니다. 예: `google`, `okta_workforce` |
| `Protocol`     | `OAuth 2.0` 또는 `SAML 2.0`                           |
| `Display name` | 로그인 화면에 표시할 이름입니다.                      |
| `Enabled`      | IdP 활성화 여부입니다.                                |

## IdP 추가 절차

1. 상단 `Tenant` 선택 박스에서 IdP를 추가할 tenant를 선택합니다.
2. `Create`를 눌러 provider key, protocol, display name을 입력합니다.
3. protocol에 맞는 OAuth 2.0 또는 SAML 2.0 필수 설정을 입력합니다.
4. `Enabled`를 켜기 전에 callback URL, certificate, secret이 운영 IdP 설정과 일치하는지 확인합니다.
5. 저장 후 tenant 정책의 allowed IdP 또는 client 정책의 allowed IdP 제한에 provider key를 연결합니다.
6. Interaction UI 로그인 화면에서 외부 로그인 버튼이 노출되는지 확인합니다.

:::caution
IdP는 tenant별 리소스입니다. 같은 Google, Okta, SAML 연동이라도 tenant가 다르면 provider key, client secret, certificate를 분리해서 등록합니다.
:::

## OAuth 2.0 필드

| 필드                     | 설명                                          |
| ------------------------ | --------------------------------------------- |
| `Client ID`              | 외부 provider에서 발급한 OAuth client ID      |
| `Client secret`          | 외부 provider에서 발급한 secret. 생성 시 필수 |
| `Authorization endpoint` | 사용자를 외부 로그인 화면으로 보낼 URL        |
| `Token endpoint`         | authorization code를 token으로 교환할 URL     |
| `Userinfo endpoint`      | 외부 사용자 프로필을 조회할 URL               |

:::warning
OAuth client secret은 생성 시 필수입니다. 수정 시 비워두면 기존 값을 유지합니다.
:::

OAuth provider에는 서비스의 callback URL을 redirect URI로 등록해야 합니다.

```text
/t/{tenantCode}/interaction/{uid}/idp/{provider}/callback
```

운영 환경에서는 실제 issuer/host 기준 URL을 등록합니다.

## SAML 2.0 필드

| 필드                        | 설명                                                |
| --------------------------- | --------------------------------------------------- |
| `IdP SSO URL`               | SAML login 요청을 보낼 IdP endpoint                 |
| `IdP certificate`           | assertion 또는 response 서명 검증용 PEM certificate |
| `IdP issuer`                | 외부 IdP issuer                                     |
| `Audience`                  | assertion 대상 SP 식별자                            |
| `NameID format`             | NameID 형식                                         |
| `Requested AuthnContext`    | IdP에 요청할 인증 컨텍스트                          |
| `Subject attribute`         | 내부 사용자 subject로 매핑할 attribute              |
| `Email attribute`           | 내부 email claim으로 매핑할 attribute               |
| `Accepted clock skew`       | assertion 시간 검증 허용 오차                       |
| `Max assertion age`         | assertion 최대 유효 시간                            |
| `Request ID expiration`     | SAML request ID 재사용 방지 만료 시간               |
| `Require signed assertions` | assertion 서명 필수 여부                            |
| `Require signed response`   | response 서명 필수 여부                             |
| `Force re-authentication`   | IdP 재인증 강제 여부                                |

SAML 인증서는 PEM 형식으로 입력합니다. 여러 인증서를 넣을 때는 빈 줄로 구분합니다.

## 정책 연결

| 위치                                  | 역할                                    |
| ------------------------------------- | --------------------------------------- |
| Tenant 정책 `allowedIdp.providerKeys` | tenant 전체에서 사용할 수 있는 IdP 제한 |
| Client 정책 `allowedIdpProviderKeys`  | 특정 client에서 사용할 수 있는 IdP 제한 |

provider key를 생성했더라도 정책에서 제외되어 있으면 해당 로그인 흐름에서 노출되지 않을 수 있습니다.

## 확인 체크리스트

- provider key가 tenant 안에서 중복되지 않습니다.
- OAuth client secret, SAML certificate 원문이 로그에 남지 않습니다.
- SAML production 설정에서 assertion 또는 response 서명 검증을 끄지 않습니다.
- Interaction UI에서 `GET ./api/details` 응답의 `idpList`에 provider가 포함됩니다.
