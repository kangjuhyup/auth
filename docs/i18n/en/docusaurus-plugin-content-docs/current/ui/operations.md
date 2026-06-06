---
title: Operations
---

# Operations

Operational checks for running and maintaining the Auth platform.

## Common Checks

| Area           | Check                                                        |
| -------------- | ------------------------------------------------------------ |
| Service        | Health endpoint, logs, metrics, database connectivity        |
| Redis          | Login attempt counters, OIDC cache, and adapter connectivity |
| Database       | Migrations applied and seed admin exists                     |
| Keys           | JWKS active and previous keys during rotation overlap        |
| Admin UI       | API base URL and tenant selection                            |
| Interaction UI | `service/interaction-ui/dist` exists in deployed service     |

## Build Commands

```bash
yarn workspace @auth/service build
yarn workspace @auth/ui build
yarn interaction-ui:build
yarn docs:build
```

## Troubleshooting

| Symptom                     | Check                                                |
| --------------------------- | ---------------------------------------------------- |
| Interaction UI not built    | Run `yarn interaction-ui:build` and restart service  |
| OpenAPI docs missing schema | Response schema registration                         |
| Login blocked               | Login attempt policy and Redis state                 |
| Token rejected              | Client grant, scope, redirect URI, and PKCE settings |
