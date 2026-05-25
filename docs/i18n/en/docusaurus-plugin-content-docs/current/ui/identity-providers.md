---
title: Identity Providers
---

# Identity Providers

Path: `/admin/identity-providers`

Connect external identity providers to a tenant. OAuth 2.0 and SAML 2.0 providers are supported. For the conceptual model, see [IdP](../concepts/idp.md).

## Common Fields

| Field          | Description                                              |
| -------------- | -------------------------------------------------------- |
| `Provider key` | Provider identifier such as `google` or `okta_workforce` |
| `Protocol`     | `OAuth 2.0` or `SAML 2.0`                                |
| `Display name` | Name displayed on login screens                          |
| `Enabled`      | Whether the provider is available                        |

## Add an IdP

1. Select the tenant that will own the IdP from the top `Tenant` selector.
2. Click `Create` and enter the provider key, protocol, and display name.
3. Fill in the required OAuth 2.0 or SAML 2.0 settings for the selected protocol.
4. Before enabling the provider, verify that callback URLs, certificates, and secrets match the external IdP configuration.
5. After saving, connect the provider key to the tenant allowed IdP policy or the client allowed IdP restriction.
6. Confirm that the external login button appears in the Interaction UI login screen.

:::caution
IdPs are tenant-scoped resources. Even when connecting the same Google, Okta, or SAML provider, keep provider keys, client secrets, and certificates separated per tenant.
:::

## OAuth 2.0

| Field                    | Description                                                        |
| ------------------------ | ------------------------------------------------------------------ |
| `Client ID`              | OAuth client ID issued by the provider                             |
| `Client secret`          | Required on creation. Leave empty on update to keep existing value |
| `Authorization endpoint` | URL that sends the user to the external login screen               |
| `Token endpoint`         | URL used to exchange an authorization code for tokens              |
| `Userinfo endpoint`      | URL used to fetch the external user profile                        |

Register the service callback URL as a redirect URI in the OAuth provider.

```text
/t/{tenantCode}/interaction/{uid}/idp/{provider}/callback
```

In production, register the URL with the real issuer/host.

## SAML 2.0

| Field                       | Description                                                            |
| --------------------------- | ---------------------------------------------------------------------- |
| `IdP SSO URL`               | SAML SSO endpoint                                                      |
| `IdP certificate`           | PEM certificate. Multiple certificates can be separated by blank lines |
| `IdP issuer`                | Identity provider issuer                                               |
| `Audience`                  | Expected SP audience                                                   |
| `NameID format`             | NameID format                                                          |
| `Require signed assertions` | Require signed SAML assertions                                         |
| `Require signed response`   | Require signed SAML responses                                          |

Secrets and certificates must not be logged.

## Policy Connection

| Location                                | Role                                         |
| --------------------------------------- | -------------------------------------------- |
| Tenant policy `allowedIdp.providerKeys` | Restricts IdPs allowed across the tenant     |
| Client policy `allowedIdpProviderKeys`  | Restricts IdPs allowed for a specific client |

Even if a provider key exists, it may not appear in a login flow when excluded by policy.

## Verification Checklist

- The provider key is unique inside the tenant.
- OAuth client secrets and raw SAML certificate material are not logged.
- Production SAML settings keep assertion or response signature verification enabled.
- The Interaction UI `GET ./api/details` response includes the provider in `idpList`.
