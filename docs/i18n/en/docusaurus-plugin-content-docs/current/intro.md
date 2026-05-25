---
sidebar_position: 1
title: Documentation Overview
slug: /
---

# Auth Docs

Auth Docs is the documentation portal for operating the OIDC Authorization Server and Admin UI.

## Documentation Areas

| Area           | Content                                                                      |
| -------------- | ---------------------------------------------------------------------------- |
| Core Concepts  | Tenant, Client, RBAC, OIDC flow, MFA, IdP, Grant, Scope, and policy concepts |
| Admin UI       | Screen-by-screen usage and operational procedures                            |
| Interaction UI | Customizing login, consent, and MFA screens                                  |
| API            | OpenAPI / Redoc API reference                                                |
| Operations     | Handling secrets, tokens, recovery codes, and sensitive data                 |

## Start Here

| Document                                               | Description                                                           |
| ------------------------------------------------------ | --------------------------------------------------------------------- |
| [Core Concepts](./concepts.md)                         | Relationship between Tenant, Client, RBAC, and policy concepts        |
| [Document Map](./document-map.md)                      | Where AuthDocs and workspace-local docs live                          |
| [OIDC Flow](./concepts/oidc-flow.md)                   | Authorization Code + PKCE and interaction flow                        |
| [Tenant Overview](./concepts/tenant/overview.md)       | Tenant security boundary, issuer, and resource isolation              |
| [Tenant Policies](./concepts/tenant/policies.md)       | Tenant-level authentication, MFA, session, and signup policies        |
| [Client Overview](./concepts/client/overview.md)       | Client types, redirect URIs, logout URIs, and main attributes         |
| [Client Policies](./concepts/client/policies.md)       | Client authentication policies and effective policy calculation       |
| [Grant Overview](./concepts/client/grants/overview.md) | OAuth/OIDC grant types allowed for a client                           |
| [Custom Grant](./concepts/client/grants/custom.md)     | How to add a custom OAuth `grant_type`                                |
| [Scope Overview](./concepts/client/scopes.md)          | Scope and resource indicator semantics                                |
| [MFA Overview](./concepts/mfa.md)                      | Multi-factor authentication policy, enrollment, and verification flow |
| [IdP Overview](./concepts/idp.md)                      | External identity provider connection model and protocol settings     |
| [Custom IdP](./concepts/idp/custom.md)                 | Rules for OAuth2/OIDC-style and SAML 2.0 custom IdPs                  |
| [Interaction UI Customization](./ui/interaction-ui.md) | Safe customization points for login, consent, and MFA UI              |
| [Redoc API Reference](./api/redoc.md)                  | How to open the OpenAPI / Redoc reference                             |

## Run

```bash
yarn docs:dev
```

The default development server runs at `http://localhost:3100`.

## Build

```bash
yarn docs:build
```

The static output is generated under `docs/build/`.
