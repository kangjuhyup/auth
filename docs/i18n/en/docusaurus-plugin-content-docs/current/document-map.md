---
title: Document Map
description: Roles and locations of AuthDocs and workspace-local Markdown files
---

# Document Map

AuthDocs is the user and operator documentation portal for this repository. Markdown sources live under `docs/docs`. Workspace-local `docs` directories only keep developer-facing notes that are useful while working inside that app.

## Location Rules

| Location                      | Role                                                           | Examples                                                          |
| ----------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| `docs/docs`                   | AuthDocs source: concepts, Admin UI, Interaction UI, API usage | Tenant concepts, OIDC flow, Client Grant, MFA, IdP, screen guides |
| `service/docs`                | Backend developer and operations notes                         | OIDC provider internals, database, logging, metrics               |
| `ui/docs`                     | Admin UI developer index                                       | Links to AuthDocs UI pages and local dev notes                    |
| `service/interaction-ui/docs` | Interaction UI app customization notes                         | Build, static serving, prompt screen changes                      |
| `README.md`                   | Repository entry point                                         | Quick start and documentation links                               |

## AuthDocs

| Document                                               | Description                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| [Documentation Overview](./intro.md)                   | AuthDocs entry point                                         |
| [Core Concepts](./concepts.md)                         | Tenant, Client, RBAC, MFA, and IdP relationship              |
| [OIDC Flow](./concepts/oidc-flow.md)                   | Authorization Code + PKCE flow                               |
| [Tenant Overview](./concepts/tenant/overview.md)       | Tenant security boundary and issuer                          |
| [Tenant Policies](./concepts/tenant/policies.md)       | Tenant-level security policies                               |
| [Client Overview](./concepts/client/overview.md)       | Client attributes and OIDC/OAuth settings                    |
| [Client Policies](./concepts/client/policies.md)       | Client authentication policy overrides                       |
| [Grant Overview](./concepts/client/grants/overview.md) | Client grant type policy                                     |
| [Custom Grant](./concepts/client/grants/custom.md)     | Custom `grant_type` extension procedure                      |
| [Scope Overview](./concepts/client/scopes/overview.md) | Scope and resource indicator behavior                        |
| [Custom Scope](./concepts/client/scopes/custom.md)     | Service-specific custom scope definition rules               |
| [MFA Overview](./concepts/mfa.md)                      | MFA methods, enrollment, and interaction verification        |
| [IdP](./concepts/idp.md)                               | External identity provider protocols and policy restrictions |
| [Redoc API Reference](./api/redoc.md)                  | OpenAPI / Redoc reference                                    |

## Admin UI

| Document                                         | Description                             |
| ------------------------------------------------ | --------------------------------------- |
| [Admin UI Overview](./ui/overview.md)            | Common layout and development execution |
| [Tenants](./ui/tenants.md)                       | Create, select, and configure tenants   |
| [Clients](./ui/clients.md)                       | Manage OIDC/OAuth clients               |
| [Tenant Policies](./ui/policies.md)              | Tenant policy screen usage              |
| [Identity Providers](./ui/identity-providers.md) | OAuth2/SAML IdP connection              |
| [Access](./ui/access.md)                         | Users, groups, roles, and permissions   |
| [Consent](./ui/consent.md)                       | User consent management                 |
| [Audit Log](./ui/audit-log.md)                   | Audit log lookup                        |
| [Security](./ui/security.md)                     | Admin UI security behavior              |
| [Operations](./ui/operations.md)                 | Operational checks                      |

## Workspace-Local Docs

| Document                                       | Description                                        |
| ---------------------------------------------- | -------------------------------------------------- |
| `service/README.md`                            | Backend structure and run instructions             |
| `service/docs/README.md`                       | Backend-local documentation index                  |
| `service/interaction-ui/docs/CUSTOMIZATION.md` | Source-oriented Interaction UI customization guide |
| `ui/docs/README.md`                            | Admin UI developer documentation index             |
