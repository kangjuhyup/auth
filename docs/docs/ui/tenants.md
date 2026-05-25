---
title: Tenants
---

# Tenants

경로: `/admin/tenants`

tenant를 생성, 수정, 삭제합니다. tenant는 인증 서버 안에서 고객, 조직, 서비스 단위를 분리하는 보안 경계입니다. 개념 설명은 [Tenant 개요](../concepts/tenant/overview.md)를 먼저 참고하세요.

## Tenant 선택

상단 `Tenant` 선택 박스에서 작업할 tenant를 선택합니다.

- tenant가 선택되지 않으면 tenant 범위 리소스 화면에서 경고가 표시됩니다.
- 최초 진입 시 `master` tenant가 있으면 우선 선택합니다.
- `master` tenant가 없으면 목록의 첫 tenant를 선택합니다.

## 필드

| 필드                         | 설명                                            |
| ---------------------------- | ----------------------------------------------- |
| `Code`                       | tenant 식별자입니다. 생성 후 수정하지 않습니다. |
| `Name`                       | tenant 이름입니다.                              |
| `Brand Name`                 | UI 또는 알림에서 사용할 브랜드명입니다.         |
| `Signup Policy`              | `Invite Only` 또는 `Open Signup` 중 선택합니다. |
| `Require Phone Verification` | 전화번호 인증 필수 여부입니다.                  |

## 정책 설정

tenant 수정 모달에서는 tenant 기본 정보와 함께 tenant 전체 정책을 설정합니다.

| 정책 영역        | 설명                                                            |
| ---------------- | --------------------------------------------------------------- |
| Password policy  | 비밀번호 길이, 문자 조합, 재사용 제한, 만료, 잠금 정책입니다.   |
| MFA policy       | tenant 사용자와 관리자 사용자에게 MFA를 요구할지 설정합니다.    |
| IdP policy       | 허용할 IdP provider key를 제한합니다. 비워두면 전체 허용입니다. |
| Session policy   | 세션 최대 수명, `auth_time` 요구, 재인증 주기를 설정합니다.      |
| Refresh token    | refresh token TTL과 rotation 사용 여부를 설정합니다.             |
| Signup policy    | 가입 방식과 허용 이메일 도메인을 설정합니다.                    |

정책 저장은 `/t/{tenantCode}/admin/policies` API로 수행됩니다. tenant 기본 정보 저장 후 정책 저장이 이어서 실행되며, 정책 변경 후 client의 effective policy 계산 결과가 달라질 수 있습니다.

tenant 전체에 적용되는 인증, MFA, 세션, refresh token, 가입 정책은 [Tenant 정책](../concepts/tenant/policies.md)을 참고하세요.
