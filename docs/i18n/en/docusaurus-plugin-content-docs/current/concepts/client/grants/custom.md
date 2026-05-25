---
title: Custom
description: How to add a custom OAuth grant_type with node-oidc-provider
---

# Custom Grant

| Item                  | Description                                                            |
| --------------------- | ---------------------------------------------------------------------- |
| Purpose               | Defines the standard procedure for adding a custom OAuth `grant_type`. |
| Audience              | Auth server developers and OIDC extension implementers                 |
| Source Operations Doc | `service/docs/OIDC_CUSTOM_GRANT.md`                                    |
| Main Code             | `service/src/infrastructure/oidc-provider/custom-grants`               |

## Overview

This service uses `node-oidc-provider` as the OAuth/OIDC protocol engine. Custom grants are registered through `Provider#registerGrantType` immediately after a provider instance is created. Client registration policy is validated separately through `GrantTypeRegistryPort`.

:::caution
Core security behavior such as token issuance, client authentication, and replay protection must not bypass the provider flow.
:::

## Scope

| Area                                  | Included | Description                                              |
| ------------------------------------- | -------- | -------------------------------------------------------- |
| Custom `grant_type` registration      | Yes      | Handle new token endpoint grant flow                     |
| Client `grantTypes` policy validation | Yes      | Validate client type, application type, and auth method  |
| OIDC `Grant` model customization      | No       | See the service operations doc for consent/scope storage |
| Token signing pipeline rewrite        | No       | Delegated to the provider                                |

## Components

| File                             | Responsibility                                         |
| -------------------------------- | ------------------------------------------------------ |
| `custom-grants/index.ts`         | List of custom grant definitions                       |
| `custom-grant-type.ts`           | Custom grant definition type                           |
| `register-custom-grant-types.ts` | Calls `Provider#registerGrantType`                     |
| `grant-type-registry.adapter.ts` | Supported grant list and client policy validation      |
| `oidc-provider.factory.ts`       | Registers custom grants after tenant provider creation |
| `client.dto.ts`                  | Allows built-in grants or `urn:...` custom grant input |

## Add a Custom Grant

1. Add a definition to `CUSTOM_GRANT_TYPES`.
2. Use a `urn:...` grant type that does not conflict with built-in grants.
3. List accepted token endpoint parameters in `parameters`.
4. Return a provider grant handler from `createHandler(context)`.
5. Add the same grant type to the client's `grantTypes`.
6. Add tests for registry validation, provider registration, and DTO validation.

```ts
export const CUSTOM_GRANT_TYPES: CustomGrantTypeDefinition[] = [
  {
    grantType: 'urn:auth:grant-type:magic_link',
    displayName: 'Magic Link',
    builtIn: false,
    enabled: true,
    allowedClientTypes: ['confidential'],
    allowedApplicationTypes: ['web'],
    requiresClientAuthentication: true,
    parameters: ['magic_token', 'scope'],
    createHandler: (context) => async (ctx, next) => {
      const magicToken = ctx.oidc.params.magic_token;

      // Validate token, check client policy, and write audit events.
      // Do not log raw tokens, secrets, or authorization codes.

      await next();
    },
  },
];
```

## Security Criteria

| Criterion             | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| Client authentication | Grants requiring authentication must not allow `none`                   |
| Parameter whitelist   | Use only parameters declared in `parameters`                            |
| Log masking           | Do not log raw tokens, authorization codes, secrets, or one-time tokens |
| Policy validation     | Validate client type and application type in addition to `grantTypes`   |
| Tests                 | Cover supported list, disabled grants, auth requirements, and DTO input |

## Related Docs

| Document                        | Description                                   |
| ------------------------------- | --------------------------------------------- |
| [Grant Overview](./overview.md) | Client grant type policy and validation rules |
| [OIDC Flow](../../oidc-flow.md) | Authorization Code + PKCE flow                |
