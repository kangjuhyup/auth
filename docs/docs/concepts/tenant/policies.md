---
title: 정책
description: Tenant 전체에 적용되는 기본 인증, MFA, 세션, refresh token, 가입 정책
---

# Tenant 정책

Tenant 정책은 tenant 내부 모든 client와 user에게 적용되는 기본 보안 기준입니다. client별 정책은 이 기본값 위에서 더 좁거나 구체적인 조건을 적용합니다.

:::caution
tenant 정책은 보안 하한선입니다. tenant에서 필수로 켠 MFA나 `requireAuthTime` 같은 강한 조건은 client에서 약화할 수 없습니다.
:::

## 정책 세트

| 정책          | 역할                                                                         |
| ------------- | ---------------------------------------------------------------------------- |
| Password      | 비밀번호 생성, 변경, 재사용, 잠금 기준                                       |
| MFA           | tenant 일반 사용자와 관리자 MFA 필수 여부. 상세는 [MFA 개요](../mfa.md) 참고 |
| Allowed IdP   | tenant에서 허용할 외부 Identity Provider. 상세는 [IdP 개요](../idp.md) 참고  |
| Session       | 로그인 세션 수명과 재인증 기준                                               |
| Refresh Token | refresh token 수명, rotation, reuse 대응                                     |
| Signup        | 가입 허용 방식과 이메일 도메인 제한                                          |

## Password

| 필드                      | 기본값 | 범위                     | 설명                          |
| ------------------------- | ------ | ------------------------ | ----------------------------- |
| `minLength`               | `12`   | `8` - `128`              | 비밀번호 최소 길이            |
| `requireUppercase`        | `true` | boolean                  | 대문자 포함 여부              |
| `requireLowercase`        | `true` | boolean                  | 소문자 포함 여부              |
| `requireNumber`           | `true` | boolean                  | 숫자 포함 여부                |
| `requireSymbol`           | `true` | boolean                  | 특수문자 포함 여부            |
| `preventReuseCount`       | `5`    | `0` - `50`               | 최근 N개 비밀번호 재사용 방지 |
| `expiresInDays`           | `90`   | `1` - `3650` 또는 `null` | 비밀번호 만료 주기            |
| `lockoutFailureThreshold` | `5`    | `1` - `100`              | 잠금 전 실패 횟수             |
| `lockoutDurationSec`      | `900`  | `60` - `86400`           | 잠금 유지 시간                |

## MFA

| 필드            | 기본값  | 설명                              |
| --------------- | ------- | --------------------------------- |
| `required`      | `false` | tenant 일반 사용자에게 MFA를 요구 |
| `adminRequired` | `true`  | 관리자 계정에 MFA를 요구          |

운영 기준:

- `adminRequired`는 기본적으로 유지합니다.
- `required`가 `true`이면 client 정책에서 MFA를 끌 수 없습니다.
- client별 MFA 방식 제한은 [Client 정책](../client/policies.md)의 `allowedMfaMethods`에서 관리합니다.

## Allowed IdP

| 필드           | 기본값 | 설명                                                                        |
| -------------- | ------ | --------------------------------------------------------------------------- |
| `providerKeys` | `null` | 허용 IdP provider key 목록. `null`이면 tenant에 설정된 IdP 제한을 두지 않음 |

운영 기준:

- 특정 기업 IdP만 허용해야 하는 tenant는 `providerKeys`를 명시합니다.
- client 정책의 `allowedIdpProviderKeys`가 있으면 client에는 더 좁은 IdP 목록을 적용합니다.

## Session

| 필드                          | 기본값  | 범위                          | 설명                          |
| ----------------------------- | ------- | ----------------------------- | ----------------------------- |
| `maxAgeSec`                   | `28800` | `60` - `31536000` 또는 `null` | 세션 최대 수명. 기본 8시간    |
| `requireAuthTime`             | `false` | boolean                       | token에 인증 시각 검증을 요구 |
| `reauthenticationIntervalSec` | `null`  | `60` - `31536000` 또는 `null` | 일정 시간 이후 재인증 요구    |

## Refresh Token

| 필드              | 기본값         | 범위              | 설명                              |
| ----------------- | -------------- | ----------------- | --------------------------------- |
| `ttlSec`          | `1209600`      | `60` - `31536000` | refresh token 기본 TTL. 기본 14일 |
| `rotationEnabled` | `true`         | boolean           | refresh token rotation 사용 여부  |
| `reuseAction`     | `revoke_grant` | 고정              | reuse 감지 시 grant revoke        |

reuse 감지 시 token 원문을 로그에 남기지 않고 audit event와 revoke 정책으로 대응합니다.

## Signup

| 필드                  | 기본값   | 설명                                      |
| --------------------- | -------- | ----------------------------------------- |
| `mode`                | `invite` | `invite` 또는 `open`                      |
| `allowedEmailDomains` | `[]`     | open signup에서 허용할 이메일 도메인 목록 |

운영 tenant는 `invite`를 기본값으로 두고, `open`을 사용할 때는 `allowedEmailDomains`로 가입 범위를 제한합니다.

## 관련 문서

| 문서                                         | 설명                                 |
| -------------------------------------------- | ------------------------------------ |
| [Tenant 개요](./overview.md)                 | tenant 보안 경계와 issuer            |
| [Client 정책](../client/policies.md)         | client별 override와 effective policy |
| [MFA 개요](../mfa.md)                        | MFA 등록과 인증 흐름                 |
| [IdP 개요](../idp.md)                        | OAuth2/SAML IdP 연동 구조            |
| [Tenant Policies 화면](../../ui/policies.md) | 관리자 UI 정책 화면 사용법           |
