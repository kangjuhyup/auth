---
title: Policies
description: Tenant-level authentication, MFA, session, refresh token, and signup policies
---

# Tenant Policies

Tenant policies are baseline security settings applied to all users and clients inside a tenant. Client policies can only narrow or specialize those defaults.

:::caution
Tenant policies are the security floor. Strong tenant-level requirements such as MFA or `requireAuthTime` cannot be weakened by a client policy.
:::

## Policy Set

| Policy                   | Role                                                    |
| ------------------------ | ------------------------------------------------------- |
| Password                 | Password creation, reuse, expiration, and lockout rules |
| [MFA](../mfa.md)         | MFA requirement for tenant users and admins             |
| [Allowed IdP](../idp.md) | External identity providers allowed for the tenant      |
| Session                  | Session lifetime and reauthentication rules             |
| Refresh Token            | Refresh token lifetime, rotation, and reuse response    |
| Signup                   | Signup mode and allowed email domains                   |

## Password

| Field                     | Default | Range                  | Description                       |
| ------------------------- | ------- | ---------------------- | --------------------------------- |
| `minLength`               | `12`    | `8` - `128`            | Minimum password length           |
| `requireUppercase`        | `true`  | boolean                | Require uppercase letters         |
| `requireLowercase`        | `true`  | boolean                | Require lowercase letters         |
| `requireNumber`           | `true`  | boolean                | Require digits                    |
| `requireSymbol`           | `true`  | boolean                | Require symbols                   |
| `preventReuseCount`       | `5`     | `0` - `50`             | Prevent reuse of recent passwords |
| `expiresInDays`           | `90`    | `1` - `3650` or `null` | Password expiration period        |
| `lockoutFailureThreshold` | `5`     | `1` - `100`            | Failures before lockout           |
| `lockoutDurationSec`      | `900`   | `60` - `86400`         | Lockout duration                  |

## MFA

See [MFA Overview](../mfa.md) for supported methods, enrollment, and Interaction UI verification flow.

| Field           | Default | Description                  |
| --------------- | ------- | ---------------------------- |
| `required`      | `false` | Require MFA for tenant users |
| `adminRequired` | `true`  | Require MFA for admin users  |

If tenant MFA is required, client policy cannot disable it.

## Allowed IdP

See [IdP](../idp.md) for provider keys, OAuth2/OIDC-style providers, and SAML 2.0 settings.

| Field          | Default | Description                                                                             |
| -------------- | ------- | --------------------------------------------------------------------------------------- |
| `providerKeys` | `null`  | Allowed identity provider keys. `null` means no additional tenant-level IdP restriction |

## Session

| Field                         | Default | Range                       | Description                                  |
| ----------------------------- | ------- | --------------------------- | -------------------------------------------- |
| `maxAgeSec`                   | `28800` | `60` - `31536000` or `null` | Maximum session age. Default is 8 hours      |
| `requireAuthTime`             | `false` | boolean                     | Require authentication time verification     |
| `reauthenticationIntervalSec` | `null`  | `60` - `31536000` or `null` | Require reauthentication after this interval |

## Refresh Token

| Field             | Default        | Range             | Description                           |
| ----------------- | -------------- | ----------------- | ------------------------------------- |
| `ttlSec`          | `1209600`      | `60` - `31536000` | Refresh token TTL. Default is 14 days |
| `rotationEnabled` | `true`         | boolean           | Enable refresh token rotation         |
| `reuseAction`     | `revoke_grant` | fixed             | Revoke grant when reuse is detected   |

Raw refresh tokens must not be logged in audit logs, application logs, or error responses.

## Signup

| Field                 | Default  | Description                           |
| --------------------- | -------- | ------------------------------------- |
| `mode`                | `invite` | `invite` or `open`                    |
| `allowedEmailDomains` | `[]`     | Email domains allowed for open signup |

Production tenants should usually keep `invite` as the default. If `open` is used, restrict signup with `allowedEmailDomains`.

## Related Docs

| Document                                 | Description                           |
| ---------------------------------------- | ------------------------------------- |
| [MFA Overview](../mfa.md)                | MFA methods and enrollment flow       |
| [IdP](../idp.md)                         | External provider configuration model |
| [Client Policies](../client/policies.md) | Client-level policy overrides         |
