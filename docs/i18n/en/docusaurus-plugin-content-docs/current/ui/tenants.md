---
title: Tenants
---

# Tenants

Path: `/admin/tenants`

Create, update, and delete tenants. A tenant is a security boundary that separates customers, organizations, or services. See [Tenant Overview](../concepts/tenant/overview.md).

## Tenant Selection

Use the `Tenant` selector in the header before working with tenant-scoped resources.

- If no tenant is selected, tenant-scoped screens show a warning.
- If `master` exists, it is preferred on first entry.
- Otherwise, the first tenant in the list is selected.

## Fields

| Field                        | Description                                           |
| ---------------------------- | ----------------------------------------------------- |
| `Code`                       | Tenant identifier. Treat as immutable after creation. |
| `Name`                       | Tenant name                                           |
| `Brand Name`                 | Brand name used in UI or notifications                |
| `Signup Policy`              | `Invite Only` or `Open Signup`                        |
| `Require Phone Verification` | Whether phone verification is required                |

## Policies

Tenant-level authentication, MFA, session, refresh token, and signup policies are explained in [Tenant Policies](../concepts/tenant/policies.md).
