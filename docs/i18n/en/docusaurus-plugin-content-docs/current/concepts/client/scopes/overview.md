---
title: Scope
description: Client scope and resource indicator semantics
---

# Scope Overview

A client's `scope` defines which user information or permission ranges the client may request. OIDC login usually requires `openid`, and may also use standard scopes such as `profile` and `email` plus service-specific custom scopes.

## Scope Format

Scopes are stored as a space-delimited string.

```text
openid profile email
```

Authorization requests use the same logical format.

```text
scope=openid%20profile%20email
```

## Common Scopes

| Scope        | Meaning                                             |
| ------------ | --------------------------------------------------- |
| `openid`     | Required to indicate an OIDC login request          |
| `profile`    | Request profile claims such as name or display name |
| `email`      | Request email claims                                |
| custom scope | Service API or domain-specific permission range     |

## Scope and Claims

Scope is an upper bound on what the client may request. Actual claims in ID tokens, access tokens, and userinfo responses depend on provider configuration, user consent, policies, and `findAccount` callback results.

Operational rules:

- OIDC login clients must include `openid`.
- Allow only scopes that are actually needed.
- Do not expose credentials, secrets, or internal policy state through scopes or claims.
- Inject custom claims only through provider callbacks and policy-based logic.

## Consent and Scope

Consent screens are based on requested scopes and existing consent state.

| Situation                  | Behavior                                            |
| -------------------------- | --------------------------------------------------- |
| New scope requested        | Show consent to the user                            |
| Previously consented scope | Existing Grant may be reused                        |
| `skipConsent` client       | Grant may be created automatically if policy allows |

## Allowed Resources

`allowedResources` lists API resource origins that can be requested through OAuth Resource Indicators.

```text
https://api.example.com
```

Operational rules:

- Allow HTTPS origins only.
- Match resources to tenant boundaries.
- Register only APIs that the client actually calls.
- Do not allow HTTP resource indicators in production.

## Scope vs RBAC

| Category | Scope                                | RBAC Permission                |
| -------- | ------------------------------------ | ------------------------------ |
| Target   | OAuth/OIDC client request range      | Admin/domain authorization     |
| Example  | `openid profile email`, custom scope | `client:update`, `tenant:read` |
| Location | token/userinfo/consent flow          | application authorization      |
| Meaning  | What a client may request            | What a user may actually do    |

Having a scope does not automatically mean the user can perform every action. APIs should evaluate both token scopes and user/admin permissions.
