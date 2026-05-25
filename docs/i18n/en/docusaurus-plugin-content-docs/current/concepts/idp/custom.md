---
title: Custom
description: Rules for adding OAuth2/OIDC-style custom IdPs and SAML 2.0 IdPs
---

# Custom IdP

A custom IdP is an external Identity Provider whose endpoints, certificates, and attribute mappings are configured by the tenant instead of being fully predefined, such as a built-in Google or Okta preset.

:::info
Connecting an IdP does not mean reimplementing the OIDC provider. The Auth service connects the external IdP result to the Interaction flow, while final OIDC code/token issuance remains delegated to `node-oidc-provider`.
:::

## Supported Scope

| Type                   | When to Use                                                       | Main Settings                                                   |
| ---------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| OAuth 2.0 / OIDC-style | External providers with authorization code and userinfo endpoints | authorization/token/userinfo endpoint, client ID, client secret |
| SAML 2.0               | Enterprise SSO, internal IdP, SAML federation                     | SSO URL, issuer, audience, certificate, attribute mapping       |

## Add Flow

1. Select a tenant on the [Identity Providers](../../ui/identity-providers.md) screen.
2. Choose a provider key, such as `corp-oauth`, `partner-saml`, or `okta-workforce`.
3. Select the protocol.
4. Fill in the required protocol-specific settings.
5. Connect the provider key to tenant policy or client policy.
6. Confirm that `idpList` appears in the Interaction UI `GET ./api/details` response.
7. Verify the external IdP button, callback, user mapping, and audit log in a real authorize flow.

## OAuth2/OIDC-style Custom IdP

An OAuth2/OIDC-style provider must support browser redirect, code exchange, and userinfo lookup.

| Setting                  | Rule                                                     |
| ------------------------ | -------------------------------------------------------- |
| `Authorization endpoint` | HTTPS URL that sends the user to external login          |
| `Token endpoint`         | HTTPS URL used to exchange authorization code for tokens |
| `Userinfo endpoint`      | HTTPS URL used to fetch external subject/email           |
| `Client ID`              | Client ID issued by the external provider                |
| `Client secret`          | Secret issued by the external provider. Never log it     |

Register the Auth service callback URL as a redirect URI in the external provider.

```text
{ISSUER}/t/{tenantCode}/interaction/{uid}/idp/{provider}/callback
```

Operating rules:

- Use HTTPS endpoints.
- Do not bypass `state` and interaction `uid` validation.
- Do not write token responses, access tokens, refresh tokens, or client secrets to logs or audit metadata.
- Do not treat login as successful when userinfo subject is missing.

## SAML 2.0 Custom IdP

For SAML providers, SP metadata, ACS endpoint, and assertion verification policies are the critical settings.

| Setting             | Rule                                                            |
| ------------------- | --------------------------------------------------------------- |
| `IdP SSO URL`       | IdP endpoint that receives SAML AuthnRequests                   |
| `IdP issuer`        | Expected assertion issuer                                       |
| `Audience`          | Expected assertion audience                                     |
| `IdP certificate`   | PEM certificate used to verify assertion or response signatures |
| `NameID format`     | NameID format agreed with the IdP                               |
| `Subject attribute` | Attribute used as the internal subject                          |
| `Email attribute`   | Attribute used as the internal email claim                      |

Operating rules:

- Keep assertion or response signature verification enabled in production.
- During certificate rotation, confirm whether old and new certificates can be registered together.
- Do not log raw `SAMLResponse`, assertions, or certificate private material.
- Avoid overly broad clock skew and max assertion age settings.

## User Mapping

The external IdP result must be linked to an internal user.

| Input            | Internal Meaning                                    |
| ---------------- | --------------------------------------------------- |
| provider key     | Identifies which IdP authenticated the user         |
| external subject | Stable external user identifier                     |
| email            | Claim used for internal lookup or display           |
| email verified   | Trust only when the provider explicitly supplies it |

The same external subject must not be linked to multiple internal users. IdP links must also remain isolated by tenant.

## Policy Connection

After the IdP is saved, policy decides whether it can actually be used.

| Policy                           | Role                               |
| -------------------------------- | ---------------------------------- |
| `tenant.allowedIdp.providerKeys` | IdPs allowed across the tenant     |
| `client.allowedIdpProviderKeys`  | IdPs allowed for a specific client |

If the client policy value is `null`, the client follows tenant policy. An empty array can mean no external IdP is allowed for that client, so use it carefully.

## Verification Checklist

- The provider key is unique inside the tenant.
- OAuth or SAML endpoints are reachable from the production environment.
- The callback URL is registered in the external provider.
- The provider key is connected to tenant/client policy.
- The provider button appears on the Interaction UI login screen.
- The callback completes the OIDC interaction successfully.
- Audit logs record provider key and result, but not raw secrets, tokens, or assertions.

## Related Docs

| Document                                             | Description                       |
| ---------------------------------------------------- | --------------------------------- |
| [IdP Overview](../idp.md)                            | IdP concept and OAuth2/SAML flow  |
| [Identity Providers](../../ui/identity-providers.md) | How to add IdPs in the Admin UI   |
| [Tenant Policies](../tenant/policies.md)             | Tenant allowed IdP policy         |
| [Client Policies](../client/policies.md)             | Client-specific IdP restrictions  |
| [OIDC Flow](../oidc-flow.md)                         | Interaction and external IdP flow |
