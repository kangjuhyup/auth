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

## 정책

tenant 전체에 적용되는 인증, MFA, 세션, refresh token, 가입 정책은 [Tenant 정책](../concepts/tenant/policies.md)을 참고하세요.
