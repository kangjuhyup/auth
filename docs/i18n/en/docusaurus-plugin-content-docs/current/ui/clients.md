---
title: Clients
---

# Clients

Path: `/admin/clients`

Manage OIDC/OAuth clients. Select a tenant first. For concept details, see [Client Overview](../concepts/client/overview.md).

## Main Fields

| Field                        | Description                                          |
| ---------------------------- | ---------------------------------------------------- |
| `Client ID`                  | OIDC `client_id`. Treat as immutable after creation. |
| `Name`                       | Client display name                                  |
| `Client Type`                | `Public`, `Confidential`, or `Service`               |
| `Enabled`                    | Whether the client is active                         |
| `Redirect URIs`              | Authorization code callback URIs                     |
| `Post Logout Redirect URIs`  | Allowed redirect URIs after logout                   |
| `Grant Types`                | Allowed OAuth grant types                            |
| `Response Types`             | Authorization endpoint response types                |
| `Allowed Scopes`             | Scope string the client may request                  |
| `Token Endpoint Auth Method` | Client authentication method at the token endpoint   |

See also:

- [Client Overview](../concepts/client/overview.md) for redirect URI and core attributes
- [Grant Overview](../concepts/client/grants/overview.md) for grant selection
- [Scope Overview](../concepts/client/scopes.md) for scope and resource indicators
- [Client Policies](../concepts/client/policies.md) for MFA, consent, and session policy

:::danger
Client secrets are not shown again after storage. During update, leaving the secret empty keeps the existing secret.
:::
