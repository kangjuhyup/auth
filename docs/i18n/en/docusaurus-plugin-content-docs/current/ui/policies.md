---
title: Tenant Policies
description: How to view and edit tenant policies in Admin UI
---

# Tenant Policies

Path: `/admin/policies`

View and update policies for the selected tenant. For policy semantics, see [Tenant Policies](../concepts/tenant/policies.md) and [Client Policies](../concepts/client/policies.md).

## Tenant Selection

Select a tenant in the header first.

- If no tenant is selected, the screen shows a warning.
- Policy lookup and updates are always scoped to the selected tenant.
- The API path includes tenant code: `/t/{tenantCode}/admin/policies`.

## Currently Editable Fields

The current Admin UI exposes MFA policy first.

| Field                          | Description                          |
| ------------------------------ | ------------------------------------ |
| `Require MFA for tenant users` | Require MFA for regular tenant users |
| `Require MFA for admin users`  | Require MFA for admin users          |

:::caution
If MFA is required at the tenant level, a specific client cannot disable it. Check the `effective` field in client auth policy responses.
:::

## Client Policy Relationship

Client authentication policies are managed from `/admin/clients` through `Client Authentication Policy`.

| Screen            | Role                      |
| ----------------- | ------------------------- |
| `/admin/policies` | Tenant-wide defaults      |
| `/admin/clients`  | Client-specific overrides |

See [Effective Policy](../concepts/client/policies.md#effective-policy) for calculation rules.
