---
title: Interaction UI Customization
description: Structure, customization points, build, and verification for OIDC interaction screens
---

# Interaction UI Customization

The Interaction UI is the React SPA shown to end users during OIDC authorization for login, consent, MFA, and MFA enrollment. It lives in `service/interaction-ui` and is served by the Nest service under `/interaction-assets` and `/t/:tenantCode/interaction/:uid`.

## Scope

| Area                           | Included    | Description                                                            |
| ------------------------------ | ----------- | ---------------------------------------------------------------------- |
| Login copy and layout          | Yes         | `LoginPage.tsx`, `index.css`                                           |
| External IdP buttons           | Yes         | `IdpButton.tsx`, `LoginPage.tsx`                                       |
| MFA and TOTP enrollment UI     | Yes         | `MfaPage.tsx`, `MfaEnrollmentPage.tsx`                                 |
| New interaction prompt         | Conditional | Requires `App.tsx`, `InteractionController`, and provider flow changes |
| OIDC protocol reimplementation | No          | Delegated to `node-oidc-provider`                                      |

## Serving Structure

| Component                                                        | Responsibility                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------- |
| `service/interaction-ui/vite.config.ts`                          | Generates static asset paths with `/interaction-assets/` base |
| `service/interaction-ui/src/api/client.ts`                       | Calls interaction APIs relative to current pathname           |
| `service/src/app.module.ts`                                      | Serves `/interaction-assets` static files                     |
| `service/src/presentation/controllers/interaction.controller.ts` | Serves interaction SPA HTML and APIs                          |

## Main APIs

```text
GET  ./api/details
POST ./api/login
POST ./api/mfa
POST ./api/mfa/totp/enroll
POST ./api/mfa/totp/confirm
POST ./api/consent
GET  ./api/abort
GET  ./idp/:provider
```

## Customization Procedure

1. Decide whether the change is copy, style, screen flow, or API contract.
2. For copy/style changes, update `pages/*`, `components/*`, and `index.css`.
3. If response fields change, update `api/client.ts` types and `App.tsx` branching.
4. If a new API is needed, update `InteractionController` and the frontend API client together.
5. If a new prompt is needed, design provider interaction flow and `App.tsx` branching together.
6. Build and verify through the real OIDC flow from the Nest origin.

## Build

```bash
yarn interaction-ui:build
yarn workspace @auth/service build
```

`service/interaction-ui/dist` is a local build artifact and must not be committed.
