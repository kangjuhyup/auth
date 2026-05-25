---
title: Custom
description: Service-specific custom scope definition and operating rules
---

# Custom Scope

Custom scopes represent service API access ranges or domain-specific permission request ranges that are difficult to express with standard OIDC scopes such as `openid`, `profile`, and `email`.

## Addition Flow

Add a custom scope by defining it in the DB, connecting `ScopeClaimStrategy` code when claims are needed, and then allowing clients to request it.

1. Choose the scope name and user-facing description.
2. Decide whether the requested scope should return additional claims.
3. Check whether existing strategy keys can express those claims.
4. Add a `ScopeClaimStrategy` in service code when the existing strategies are not enough.
5. Register the scope definition for the tenant through the admin API.
6. Add the scope to each client that may request it.
7. Verify the authorization request and token/userinfo claim results.

:::warning
Do not store executable functions or dynamic scripts in the DB. The DB stores only the scope name, description, enabled state, and `claimKeys`; actual claim generation logic belongs in service-side `ScopeClaimStrategy` code.
:::

## Definition Rules

| Rule            | Description                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------- |
| Meaningful unit | Define scopes by user-consentable capability, not by API endpoint.                                 |
| Least privilege | Allow only scopes that the client actually needs.                                                  |
| Name stability  | Scope names remain in tokens, consent records, and client settings, so do not change them lightly. |
| Tenant boundary | Design scopes so they do not cross tenant policy or resource indicator boundaries.                 |

## Naming Rule

Recommended format:

```text
resource:action
```

Examples:

```text
orders:read
orders:write
profile:manage
```

Operating rules:

- Do not expose implementation names, database table names, or sensitive policy names as scopes.
- Avoid overly broad scopes such as `admin`, `all`, or `*`.
- Scope names may be displayed on consent screens, so they should be clear.

## Admin API Example

To add a scope that represents order read access, register it through the tenant admin API.

```http
POST /t/acme/admin/scopes
Content-Type: application/json

{
  "name": "orders:read",
  "displayName": "Read orders",
  "description": "Allow this client to read order information.",
  "claimKeys": ["profile"],
  "enabled": true
}
```

Field meanings:

| Field         | Description                                                                  |
| ------------- | ---------------------------------------------------------------------------- |
| `name`        | Scope name requested by clients. Do not rename it casually after deployment. |
| `displayName` | Display name for admin UI and consent UI.                                    |
| `description` | Human-readable explanation for users and operators.                          |
| `claimKeys`   | Claim strategy keys executed when this scope is requested.                   |
| `enabled`     | Disabled scopes are excluded from client validation and provider support.    |

After registration, add the same value to the client's allowed scopes.

```text
openid profile email orders:read
```

## Relationship With Claims

Custom scopes are managed as DB-backed scope definitions. A scope definition stores the display name, description, enabled state, and `claimKeys` used by claim strategies. Service-side `ScopeClaimStrategy` code decides which claims are included in tokens or userinfo responses.

| Item         | Role                                                                         |
| ------------ | ---------------------------------------------------------------------------- |
| custom scope | DB-backed range that a client may request                                    |
| claimKeys    | Claim strategy keys executed when the scope is requested                     |
| custom claim | User or policy information included in token/userinfo                        |
| policy       | Issuance conditions such as scope request, consent skip, and MFA requirement |

Sensitive information, credentials, and internal policy state must not be exposed as custom claims either.

:::info
The DB does not store executable functions. It stores scopes such as `orders:read` and their `claimKeys`; the actual claim generation functions are registered in service-side strategies.
:::

## Claim Strategy Guidelines

Before adding a new claim, check whether an existing strategy key already covers it.

Default strategy keys:

| Strategy key | Example returned claims                 |
| ------------ | --------------------------------------- |
| `profile`    | `preferred_username`                    |
| `email`      | `email`, `email_verified`               |
| `phone`      | `phone_number`, `phone_number_verified` |

Add a strategy key when:

- The claim value is derived from user, tenant, or client policy data.
- The claim group can be reused by multiple scopes.
- The information is safe to expose through tokens or userinfo.

Do not add one for:

- Credentials or secrets such as password hashes, MFA secrets, refresh tokens, or authorization codes.
- Internal DB ids, infrastructure state, cache keys, or operator-only policy values.
- Fine-grained checks for a single API endpoint. Handle those in the resource server authorization layer.

Register strategy code under `service/src/infrastructure/oidc-provider/scope-claim-strategies`. Add the new strategy to `BUILT_IN_SCOPE_CLAIM_STRATEGIES`; `scope-claim-resolver.adapter.ts` then finds strategies by `claimKeys` and merges their claims.

```ts
import type { ScopeClaimStrategy } from './scope-claim-strategy';

export class DepartmentScopeClaimStrategy implements ScopeClaimStrategy {
  supports(claimKey: string): boolean {
    return claimKey === 'department';
  }

  resolve({ tenantId, subject }): Record<string, unknown> {
    return {
      department: `${tenantId}:${subject}:engineering`,
    };
  }
}
```

Provider callbacks pass only the requested scope's `claimKeys` to the resolver, so scopes and claims must always be explicitly connected.

## Consent Operations

Adding a new custom scope changes the consent range, so users may need to consent again.

Check before operating:

- Prepare the scope description shown to users.
- Confirm existing clients work even when they do not request the new scope.
- Separate the clients and timing that need consent re-request.

## Pre-Deployment Checklist

- Is the scope name stable and in `resource:action` form?
- Is the scope registered only for tenants that need it?
- Has the new scope been added to the allowed scopes of each client?
- Are the consent display name and description user-friendly?
- Do all `claimKeys` exist in a `ScopeClaimStrategy`?
- Are sensitive information and implementation details excluded from claims?
- Have disabled scope requests been tested as rejected?
- Does OIDC discovery expose only the intended `scopes_supported` values?
- Do existing clients that request only `openid profile email` continue to work?

## Related Docs

| Document                       | Description                                   |
| ------------------------------ | --------------------------------------------- |
| [Scope Overview](./overview)   | Scope and resource indicator basics           |
| [Client Policies](../policies) | Consent, MFA, and IdP restriction policies    |
| [OIDC Flow](../../oidc-flow)   | Authorization request and token issuance flow |
