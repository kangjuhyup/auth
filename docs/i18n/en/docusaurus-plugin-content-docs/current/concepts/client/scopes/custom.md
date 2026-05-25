---
title: Custom
description: Service-specific custom scope definition and operating rules
---

# Custom Scope

Custom scopes represent service API access ranges or domain-specific permission request ranges that are difficult to express with standard OIDC scopes such as `openid`, `profile`, and `email`.

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

## Relationship With Claims

Custom scopes do not directly guarantee claims. Provider callbacks and policy decide which claims are included in tokens or userinfo responses.

| Item         | Role                                                                         |
| ------------ | ---------------------------------------------------------------------------- |
| custom scope | Range that a client may request                                              |
| custom claim | User or policy information included in token/userinfo                        |
| policy       | Issuance conditions such as scope request, consent skip, and MFA requirement |

Sensitive information, credentials, and internal policy state must not be exposed as custom claims either.

## Consent Operations

Adding a new custom scope changes the consent range, so users may need to consent again.

Check before operating:

- Prepare the scope description shown to users.
- Confirm existing clients work even when they do not request the new scope.
- Separate the clients and timing that need consent re-request.

## Related Docs

| Document                       | Description                                   |
| ------------------------------ | --------------------------------------------- |
| [Scope Overview](./overview)   | Scope and resource indicator basics           |
| [Client Policies](../policies) | Consent, MFA, and IdP restriction policies    |
| [OIDC Flow](../../oidc-flow)   | Authorization request and token issuance flow |
