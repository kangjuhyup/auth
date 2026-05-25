---
title: Tenant Policies
description: 관리자 UI에서 tenant 정책을 조회하고 수정하는 방법
---

# Tenant Policies

경로: `/admin/policies`

선택한 tenant의 정책을 조회하고 수정합니다. 정책의 의미와 우선순위는 [Tenant 정책](../concepts/tenant/policies.md)과 [Client 정책](../concepts/client/policies.md)을 참고하세요.

## Tenant 선택

상단 `Tenant` 선택 박스에서 작업할 tenant를 먼저 선택합니다.

- tenant가 선택되지 않으면 정책 화면에서 경고가 표시됩니다.
- 정책 조회와 수정은 항상 선택된 tenant 기준으로 수행됩니다.
- API 경로도 `/t/{tenantCode}/admin/policies`처럼 tenant code를 포함합니다.

## 현재 UI에서 수정 가능한 항목

현재 관리자 UI는 MFA 정책을 우선 노출합니다.

| 필드                           | 설명                                     |
| ------------------------------ | ---------------------------------------- |
| `Require MFA for tenant users` | tenant 일반 사용자에게 MFA를 요구합니다. |
| `Require MFA for admin users`  | 관리자 사용자에게 MFA를 요구합니다.      |

:::caution
tenant에서 MFA를 필수로 설정하면 특정 client에서 MFA를 끌 수 없습니다. 실제 적용값은 client auth policy 응답의 `effective` 값을 기준으로 확인합니다.
:::

## Client 정책과의 관계

client별 인증 정책은 `/admin/clients`에서 client의 `Client Authentication Policy`로 관리합니다.

| 화면              | 역할                                                |
| ----------------- | --------------------------------------------------- |
| `/admin/policies` | tenant 전체 기본 정책 관리                          |
| `/admin/clients`  | 특정 client의 MFA 방식, 동의, 세션 등 override 관리 |

상세한 계산 기준은 [Effective Policy](../concepts/client/policies.md#effective-policy)를 참고하세요.
