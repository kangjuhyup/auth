---
title: Access
---

# Access

Manage users, groups, roles, and permissions for a tenant. For the conceptual model, see [Core Concepts](../concepts.md#rbac).

## RBAC Model

The recommended relationship is:

```text
User -> Group <- Role -> Permission
```

## Screens

| Screen      | Role                                    |
| ----------- | --------------------------------------- |
| Users       | Manage accounts inside a tenant         |
| Groups      | Group users by team or operational unit |
| Roles       | Bundle permissions into reusable roles  |
| Permissions | Define concrete allowed actions         |

## Operating Rules

- Prefer assigning roles to groups.
- Use direct user roles only for exceptions.
- Keep permissions small and action-oriented.
- Audit access changes.
