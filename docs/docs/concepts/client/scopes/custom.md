---
title: 커스텀
description: 서비스별 custom scope 정의와 운영 기준
---

# 커스텀 Scope

커스텀 scope는 표준 OIDC scope인 `openid`, `profile`, `email`로 표현하기 어려운 서비스 API 접근 범위나 도메인별 권한 요청 범위를 표현할 때 사용합니다.

## 추가 절차

커스텀 scope는 “DB에 scope 정의를 추가하고, 필요한 경우 서비스 코드에 `ScopeClaimStrategy`를 연결한 뒤, client가 해당 scope를 요청할 수 있게 허용하는” 순서로 추가합니다.

1. scope 이름과 사용자에게 보여줄 설명을 정합니다.
2. scope 요청 시 내려줄 claim이 필요한지 결정합니다.
3. 필요한 claim이 기존 strategy key로 표현되는지 확인합니다.
4. 기존 strategy로 부족하면 서비스 코드에 `ScopeClaimStrategy`를 추가합니다.
5. 관리자 API로 tenant에 scope 정의를 등록합니다.
6. 해당 scope를 요청할 client의 허용 scope 목록에 추가합니다.
7. 인증 요청과 userinfo/token claim 결과를 검증합니다.

:::warning
DB에 실행 함수나 동적 스크립트를 저장하지 않습니다. DB는 scope 이름, 설명, 활성 여부, `claimKeys`만 저장하고, 실제 claim 생성 로직은 서비스 코드의 `ScopeClaimStrategy`에 둡니다.
:::

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

## Admin API 등록 예시

예를 들어 주문 조회 API 접근 범위를 나타내는 scope를 추가하려면 tenant 관리자 API에 다음과 같이 등록합니다.

```http
POST /t/acme/admin/scopes
Content-Type: application/json

{
  "name": "orders:read",
  "displayName": "Read orders",
  "description": "Allow this client to read order information.",
  "claimKeys": ["profile"],
  "enabled": true
}
```

필드 의미:

| 필드          | 설명                                                                |
| ------------- | ------------------------------------------------------------------- |
| `name`        | client가 요청할 scope 이름입니다. 한 번 배포하면 변경하지 않습니다. |
| `displayName` | 관리자 UI와 consent UI에서 사용할 수 있는 표시 이름입니다.          |
| `description` | 사용자와 운영자가 이해할 수 있는 범위 설명입니다.                   |
| `claimKeys`   | scope 요청 시 실행할 claim strategy key 목록입니다.                 |
| `enabled`     | 비활성화하면 client scope 검증과 provider 지원 목록에서 제외됩니다. |

등록 후 client의 허용 scope에도 같은 값을 추가해야 합니다.

```text
openid profile email orders:read
```

## Claims와의 관계

커스텀 scope는 DB에 저장된 scope 정의를 기준으로 관리합니다. scope 정의에는 사용자에게 보여줄 이름, 설명, 활성 여부, 그리고 claim strategy가 사용할 `claimKeys`를 둡니다. 실제 token 또는 userinfo에 어떤 claim을 넣을지는 코드의 `ScopeClaimStrategy`가 결정합니다.

| 구분         | 역할                                              |
| ------------ | ------------------------------------------------- |
| custom scope | DB에 저장되는 client 요청 가능 범위               |
| claimKeys    | scope 요청 시 실행할 claim strategy key           |
| custom claim | token/userinfo에 포함되는 사용자 또는 정책 정보   |
| policy       | scope 요청, consent 생략, MFA 요구 같은 발급 조건 |

민감정보, credential, 내부 정책 상태는 custom claim으로도 노출하지 않습니다.

:::info
DB에는 함수를 저장하지 않습니다. DB는 `orders:read` 같은 scope와 `claimKeys`만 관리하고, 실제 claim 생성 함수는 서비스 코드의 strategy에 등록합니다.
:::

## Claim Strategy 추가 기준

새 claim을 내려야 한다면 먼저 기존 strategy key로 표현 가능한지 확인합니다.

현재 기본 strategy key:

| strategy key | 반환 claim 예시                         |
| ------------ | --------------------------------------- |
| `profile`    | `preferred_username`                    |
| `email`      | `email`, `email_verified`               |
| `phone`      | `phone_number`, `phone_number_verified` |

새 strategy key가 필요한 경우:

- claim 값이 사용자, tenant, client 정책에 따라 결정된다
- 여러 scope에서 재사용할 수 있는 claim 묶음이다
- token 또는 userinfo에 노출해도 되는 정보임이 확인됐다

추가하지 말아야 하는 경우:

- password hash, MFA secret, refresh token, authorization code 같은 credential 또는 secret
- 내부 DB id, 인프라 상태, 캐시 키, 운영자 전용 정책 값
- 한 API endpoint에서만 쓰는 세부 권한. 이런 값은 scope보다 resource server의 권한 검사로 처리합니다.

strategy 코드는 `service/src/infrastructure/oidc-provider/scope-claim-strategies`에 둡니다. 새 strategy를 만들고 `BUILT_IN_SCOPE_CLAIM_STRATEGIES`에 추가하면 `scope-claim-resolver.adapter.ts`가 `claimKeys`에 맞는 strategy를 찾아 claim을 합성합니다.

```ts
import type { ScopeClaimStrategy } from './scope-claim-strategy';

export class DepartmentScopeClaimStrategy implements ScopeClaimStrategy {
  supports(claimKey: string): boolean {
    return claimKey === 'department';
  }

  resolve({ tenantId, subject }): Record<string, unknown> {
    return {
      department: `${tenantId}:${subject}:engineering`,
    };
  }
}
```

provider 콜백은 요청된 scope의 `claimKeys`만 resolver에 전달하므로, scope와 claim은 항상 명시적으로 연결되어야 합니다.

## Consent 운영

새 custom scope를 추가하면 기존 consent와 다른 범위가 되므로 사용자에게 다시 동의가 필요할 수 있습니다.

운영 전 확인:

- 사용자에게 표시할 scope 설명을 준비합니다.
- 기존 client가 새 scope를 요청하지 않아도 동작하는지 확인합니다.
- consent 재요청이 필요한 client와 시점을 분리합니다.

## 배포 전 체크리스트

- scope 이름이 `resource:action` 형태이고 의미가 안정적인가?
- tenant별로 필요한 scope만 등록했는가?
- client 허용 scope에 새 scope가 추가됐는가?
- consent 화면에 노출될 이름과 설명이 사용자 친화적인가?
- `claimKeys`가 실제 `ScopeClaimStrategy`에 존재하는가?
- 민감정보나 내부 구현 정보가 claim으로 노출되지 않는가?
- 비활성 scope 요청이 거부되는지 테스트했는가?
- OIDC discovery의 `scopes_supported`에 의도한 scope만 노출되는가?
- `openid profile email`만 요청하는 기존 client가 영향 없이 동작하는가?

## 관련 문서

| 문서                              | 설명                                    |
| --------------------------------- | --------------------------------------- |
| [Scope 개요](./overview)          | scope와 resource indicator 기본 개념    |
| [Client 정책](../policies)        | consent, MFA, IdP 제한 정책             |
| [OIDC 인증 흐름](../../oidc-flow) | authorization request와 token 발급 흐름 |
