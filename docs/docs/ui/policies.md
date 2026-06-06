---
title: Tenant Policies
description: 관리자 UI에서 tenant 정책을 수정하는 방법
---

# Tenant Policies

경로: `/admin/tenants`의 tenant 수정 모달

tenant 정책은 tenant 수정 모달에서 기본 정보와 함께 조회하고 수정합니다. 정책의 의미와 우선순위는 [Tenant 정책](../concepts/tenant/policies.md)과 [Client 정책](../concepts/client/policies.md)을 참고하세요.

## Tenant 선택

`/admin/tenants`에서 수정할 tenant 행의 편집 버튼을 선택합니다.

- 정책 조회와 수정은 편집 중인 tenant 기준으로 수행됩니다.
- API 경로도 `/t/{tenantCode}/admin/policies`처럼 tenant code를 포함합니다.

## 현재 UI에서 수정 가능한 항목

현재 관리자 UI는 tenant 수정 모달에서 다음 정책을 노출합니다.

| 영역            | 주요 필드                                                        |
| --------------- | ---------------------------------------------------------------- |
| Password policy | 최소 길이, 문자 조합 요구, 재사용 제한, 만료, 잠금 임계값        |
| MFA policy      | tenant 사용자 MFA 필수 여부, 관리자 MFA 필수 여부                |
| IdP policy      | 허용 IdP provider key 목록                                       |
| Session policy  | 세션 최대 수명, `auth_time` 요구, 재인증 주기                    |
| Refresh token   | refresh token TTL, rotation 사용 여부                            |
| Signup policy   | 가입 방식, 허용 이메일 도메인                                    |

:::caution
tenant에서 MFA를 필수로 설정하면 특정 client에서 MFA를 끌 수 없습니다. 실제 적용값은 client auth policy 응답의 `effective` 값을 기준으로 확인합니다.
:::

## Client 정책과의 관계

client별 인증 정책은 `/admin/clients`에서 client의 `Client Authentication Policy`로 관리합니다.

| 화면             | 역할                                                |
| ---------------- | --------------------------------------------------- |
| `/admin/tenants` | tenant 전체 기본 정책 관리                          |
| `/admin/clients` | 특정 client의 MFA 방식, 동의, 세션 등 override 관리 |

상세한 계산 기준은 [Effective Policy](../concepts/client/policies.md#effective-policy)를 참고하세요.
