---
title: Roles / Groups / Users
---

# Roles / Groups / Users

RBAC는 Role Based Access Control의 약자입니다. 이 시스템의 기본 권장 관계는 `User → Group ← Role → Permission`입니다. 개념 설명은 [핵심 개념](../concepts.md#rbac)을 참고하세요.

## Roles

경로: `/admin/roles`

역할을 생성, 수정, 삭제합니다.

| 필드          | 설명                           |
| ------------- | ------------------------------ |
| `Code`        | 역할 식별자입니다. 예: `admin` |
| `Name`        | 역할 이름입니다.               |
| `Description` | 역할 설명입니다.               |

:::danger
`SUPER_ADMIN` 역할은 삭제할 수 없습니다.
:::

## Groups

경로: `/admin/groups`

그룹을 생성, 수정, 삭제하고 그룹에 역할을 부여합니다.

| 필드           | 설명                                 |
| -------------- | ------------------------------------ |
| `Code`         | 그룹 식별자입니다. 예: `engineering` |
| `Name`         | 그룹 이름입니다.                     |
| `Parent Group` | 상위 그룹입니다.                     |

## Users

경로: `/admin/users`

사용자를 생성, 수정, 삭제하고 사용자 역할과 consent를 조회합니다.

| 목록 액션    | 동작                               |
| ------------ | ---------------------------------- |
| 역할 아이콘  | 사용자 역할 관리 모달을 엽니다.    |
| audit 아이콘 | 사용자 consent 조회 모달을 엽니다. |
| 수정 아이콘  | 사용자 정보를 수정합니다.          |
| 삭제 아이콘  | 사용자를 삭제합니다.               |
