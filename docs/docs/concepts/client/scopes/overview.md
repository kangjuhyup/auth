---
title: 개요
description: Client scope와 resource indicator의 의미와 운영 기준
---

# Scope 개요

Client의 `scope`는 해당 client가 요청할 수 있는 사용자 정보 또는 권한 범위입니다. OIDC 로그인에서는 `openid`가 핵심이며, `profile`, `email` 같은 표준 scope와 서비스별 custom scope를 함께 사용할 수 있습니다.

## Scope 형식

scope는 공백으로 구분된 문자열로 저장됩니다.

```text
openid profile email
```

authorization request에서도 같은 방식으로 전달됩니다.

```text
scope=openid%20profile%20email
```

## 기본 Scope

| Scope        | 의미                                     |
| ------------ | ---------------------------------------- |
| `openid`     | OIDC 로그인 요청임을 나타내는 필수 scope |
| `profile`    | 이름, 표시명 등 profile claims 요청      |
| `email`      | 이메일 claims 요청                       |
| custom scope | 서비스 API 또는 도메인 권한 범위         |

## Scope와 Claims

scope는 client가 요청할 수 있는 범위의 상한선입니다. 실제 ID token, access token, userinfo에 어떤 claim이 들어가는지는 provider 설정, 사용자 동의, 정책, `findAccount` 콜백 결과에 따라 결정됩니다.

운영 기준:

- OIDC 로그인 client는 `openid`를 포함해야 합니다.
- 필요한 scope만 허용합니다.
- 민감정보, credential, 내부 정책 상태를 scope 또는 claims로 노출하지 않습니다.
- custom claims는 provider 콜백을 통해 정책 기반으로 주입합니다.

## Consent와 Scope

사용자 동의 화면은 client가 요청한 scope와 기존 consent 상태를 기준으로 표시됩니다.

| 상황                 | 동작                                         |
| -------------------- | -------------------------------------------- |
| 새 scope 요청        | 사용자에게 동의 화면 표시                    |
| 기존 동의 scope      | 기존 Grant를 재사용할 수 있음                |
| `skipConsent` client | 정책상 허용된 경우 동의 없이 Grant 자동 생성 |

`skipConsent`는 [Client 정책](../policies)과 함께 검토해야 합니다.

## Allowed Resources

`allowedResources`는 OAuth Resource Indicators로 요청 가능한 API resource origin 목록입니다.

```text
https://api.example.com
```

운영 기준:

- HTTPS origin만 허용합니다.
- tenant 경계와 맞는 resource만 허용합니다.
- client가 실제 호출하는 API만 등록합니다.
- HTTP resource indicator는 production에서 허용하지 않습니다.

## Scope와 RBAC의 차이

| 구분 | Scope                                | RBAC Permission                   |
| ---- | ------------------------------------ | --------------------------------- |
| 대상 | OAuth/OIDC client 요청 범위          | 관리자/도메인 권한 판단           |
| 표현 | `openid profile email`, custom scope | `client:update`, `tenant:read` 등 |
| 위치 | token/userinfo/consent 흐름          | application authorization         |
| 의미 | client가 요청 가능한 범위            | 사용자가 실제 수행 가능한 동작    |

scope가 있다고 해서 사용자가 모든 동작을 할 수 있는 것은 아닙니다. API에서는 access token의 scope와 사용자/관리자 권한을 함께 검토해야 합니다.

## 관련 문서

| 문서                              | 설명                             |
| --------------------------------- | -------------------------------- |
| [커스텀 Scope](./custom)          | 서비스별 scope 정의 기준         |
| [Client 개요](../overview)        | client 주요 속성                 |
| [Grant 개요](../grants/overview)  | grant type과 token endpoint 인증 |
| [Consent](../../../ui/consent)    | 사용자 consent 관리              |
| [OIDC 인증 흐름](../../oidc-flow) | scope 요청과 token 발급 흐름     |
