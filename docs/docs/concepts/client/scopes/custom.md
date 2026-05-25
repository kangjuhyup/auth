---
title: 커스텀
description: 서비스별 custom scope 정의와 운영 기준
---

# 커스텀 Scope

커스텀 scope는 표준 OIDC scope인 `openid`, `profile`, `email`로 표현하기 어려운 서비스 API 접근 범위나 도메인별 권한 요청 범위를 표현할 때 사용합니다.

## 정의 기준

| 기준        | 설명                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------- |
| 의미 단위   | API endpoint가 아니라 사용자가 동의할 수 있는 기능 단위로 정의합니다.                    |
| 최소 권한   | client가 실제로 필요한 scope만 허용합니다.                                               |
| 이름 안정성 | 한 번 배포된 scope 이름은 token, consent, client 설정에 남으므로 쉽게 변경하지 않습니다. |
| tenant 경계 | tenant별 정책과 resource indicator 범위를 넘지 않도록 설계합니다.                        |

## 이름 규칙

권장 형식:

```text
resource:action
```

예시:

```text
orders:read
orders:write
profile:manage
```

운영 기준:

- 내부 구현명, DB 테이블명, 민감 정책 이름을 scope에 노출하지 않습니다.
- 너무 넓은 `admin`, `all`, `*` 같은 scope는 사용하지 않습니다.
- 사용자 동의 화면에 표시될 수 있으므로 의미가 명확해야 합니다.

## Claims와의 관계

커스텀 scope는 claim을 직접 보장하지 않습니다. 실제 token 또는 userinfo에 어떤 claim을 넣을지는 provider callback과 정책에서 결정합니다.

| 구분         | 역할                                              |
| ------------ | ------------------------------------------------- |
| custom scope | client가 요청 가능한 범위                         |
| custom claim | token/userinfo에 포함되는 사용자 또는 정책 정보   |
| policy       | scope 요청, consent 생략, MFA 요구 같은 발급 조건 |

민감정보, credential, 내부 정책 상태는 custom claim으로도 노출하지 않습니다.

## Consent 운영

새 custom scope를 추가하면 기존 consent와 다른 범위가 되므로 사용자에게 다시 동의가 필요할 수 있습니다.

운영 전 확인:

- 사용자에게 표시할 scope 설명을 준비합니다.
- 기존 client가 새 scope를 요청하지 않아도 동작하는지 확인합니다.
- consent 재요청이 필요한 client와 시점을 분리합니다.

## 관련 문서

| 문서                                 | 설명                                    |
| ------------------------------------ | --------------------------------------- |
| [Scope 개요](./overview.md)          | scope와 resource indicator 기본 개념    |
| [Client 정책](../policies.md)        | consent, MFA, IdP 제한 정책             |
| [OIDC 인증 흐름](../../oidc-flow.md) | authorization request와 token 발급 흐름 |
