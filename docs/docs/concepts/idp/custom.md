---
title: 커스텀
description: OAuth2/OIDC 스타일 커스텀 IdP와 SAML 2.0 IdP를 추가하는 기준
---

# 커스텀 IdP

커스텀 IdP는 Google, Okta 같은 사전 정의 provider가 아니라 tenant가 직접 endpoint, certificate, attribute mapping을 입력해 연결하는 외부 Identity Provider입니다.

:::info
IdP 연결은 OIDC provider 자체를 다시 구현하는 작업이 아닙니다. Auth 서비스는 외부 IdP 인증 결과를 Interaction 흐름에 연결하고, 최종 OIDC code/token 발급은 `node-oidc-provider`에 위임합니다.
:::

## 지원 범위

| 유형                    | 사용 시점                                                       | 주요 설정                                                       |
| ----------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| OAuth 2.0 / OIDC 스타일 | authorization code와 userinfo endpoint를 제공하는 외부 provider | authorization/token/userinfo endpoint, client ID, client secret |
| SAML 2.0                | 기업 SSO, 사내 IdP, SAML federation                             | SSO URL, issuer, audience, certificate, attribute mapping       |

## 추가 절차

1. [Identity Providers](../../ui/identity-providers.md) 화면에서 tenant를 선택합니다.
2. provider key를 정합니다. 예: `corp-oauth`, `partner-saml`, `okta-workforce`.
3. protocol을 선택합니다.
4. protocol별 필수 설정을 입력합니다.
5. 저장 후 tenant 정책 또는 client 정책에 provider key를 연결합니다.
6. Interaction UI의 `GET ./api/details` 응답에 `idpList`가 포함되는지 확인합니다.
7. 실제 authorize 흐름에서 외부 IdP 버튼, callback, 사용자 매핑, audit log를 검증합니다.

## OAuth2/OIDC 스타일 커스텀 IdP

OAuth2/OIDC 스타일 provider는 브라우저 redirect, code 교환, userinfo 조회가 가능한 provider입니다.

| 설정                     | 기준                                                |
| ------------------------ | --------------------------------------------------- |
| `Authorization endpoint` | 사용자를 외부 로그인 화면으로 보낼 HTTPS URL        |
| `Token endpoint`         | authorization code를 token으로 교환할 HTTPS URL     |
| `Userinfo endpoint`      | 외부 사용자 subject/email을 조회할 HTTPS URL        |
| `Client ID`              | 외부 provider에서 발급한 client ID                  |
| `Client secret`          | 외부 provider에서 발급한 secret. 로그에 남기지 않음 |

외부 provider에는 Auth 서비스 callback URL을 redirect URI로 등록합니다.

```text
{ISSUER}/t/{tenantCode}/interaction/{uid}/idp/{provider}/callback
```

운영 기준:

- endpoint는 HTTPS를 사용합니다.
- `state`와 interaction `uid` 검증을 우회하지 않습니다.
- token response, access token, refresh token, client secret 원문을 로그나 audit metadata에 남기지 않습니다.
- userinfo의 subject가 비어 있으면 로그인 성공으로 처리하지 않습니다.

## SAML 2.0 커스텀 IdP

SAML provider는 SP metadata, ACS endpoint, assertion 검증 정책이 중요합니다.

| 설정                | 기준                                                |
| ------------------- | --------------------------------------------------- |
| `IdP SSO URL`       | SAML AuthnRequest를 보낼 IdP endpoint               |
| `IdP issuer`        | assertion issuer 검증 기준                          |
| `Audience`          | assertion audience 검증 기준                        |
| `IdP certificate`   | assertion 또는 response 서명 검증용 PEM certificate |
| `NameID format`     | IdP와 합의한 NameID 형식                            |
| `Subject attribute` | 내부 subject로 사용할 attribute                     |
| `Email attribute`   | 내부 email claim으로 사용할 attribute               |

운영 기준:

- production에서 assertion 또는 response 서명 검증을 끄지 않습니다.
- certificate rotation 기간에는 기존 인증서와 새 인증서를 함께 등록할 수 있는지 확인합니다.
- `SAMLResponse`, assertion 원문, certificate private material은 로그에 남기지 않습니다.
- clock skew와 max assertion age를 과도하게 넓히지 않습니다.

## 사용자 매핑

외부 IdP 인증 결과는 내부 user와 연결되어야 합니다.

| 입력             | 내부 의미                                           |
| ---------------- | --------------------------------------------------- |
| provider key     | 어떤 IdP에서 온 인증인지 식별                       |
| external subject | 외부 IdP 사용자 고유 식별자                         |
| email            | 내부 사용자 탐색 또는 표시용 claim                  |
| email verified   | provider가 email 검증 상태를 제공하는 경우에만 신뢰 |

동일한 external subject가 여러 내부 user에 연결되면 안 됩니다. 다른 tenant의 IdP 연결과도 섞이지 않아야 합니다.

## 정책 연결

IdP를 저장한 뒤에는 정책에서 실제 사용 가능 여부를 결정합니다.

| 정책                             | 역할                            |
| -------------------------------- | ------------------------------- |
| `tenant.allowedIdp.providerKeys` | tenant 전체에서 허용할 IdP 목록 |
| `client.allowedIdpProviderKeys`  | 특정 client에서 허용할 IdP 목록 |

client 정책 값이 `null`이면 tenant 정책을 따릅니다. 빈 배열은 해당 client에서 외부 IdP를 허용하지 않는 의미가 될 수 있으므로 신중하게 사용합니다.

## 검증 체크리스트

- provider key가 tenant 안에서 유일합니다.
- OAuth endpoint 또는 SAML endpoint가 운영 환경에서 접근 가능합니다.
- callback URL이 외부 provider 설정에 등록되어 있습니다.
- tenant/client 정책에 provider key가 연결되어 있습니다.
- Interaction UI 로그인 화면에 provider 버튼이 표시됩니다.
- callback 후 OIDC interaction이 정상 완료됩니다.
- audit log에 provider key와 결과는 남기되 secret/token/assertion 원문은 남기지 않습니다.

## 관련 문서

| 문서                                                 | 설명                              |
| ---------------------------------------------------- | --------------------------------- |
| [IdP 개요](../idp.md)                                | IdP 개념과 OAuth2/SAML 흐름       |
| [Identity Providers](../../ui/identity-providers.md) | 관리자 UI에서 IdP를 추가하는 방법 |
| [Tenant 정책](../tenant/policies.md)                 | tenant allowed IdP 정책           |
| [Client 정책](../client/policies.md)                 | client별 IdP 제한                 |
| [OIDC 인증 흐름](../oidc-flow.md)                    | Interaction과 외부 IdP 흐름       |
