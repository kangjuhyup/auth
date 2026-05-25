---
title: Redoc API Reference
description: How to view the service OpenAPI document with Redoc
---

# Redoc API Reference

AuthDocs renders Redoc from the static OpenAPI JSON file stored at `docs/static/openapi.json`. Deployed documentation does not call a running service to fetch the schema.

## Local URLs

| Target              | URL                                       |
| ------------------- | ----------------------------------------- |
| Static OpenAPI JSON | `http://localhost:3100/auth/openapi.json` |
| AuthDocs Redoc page | `/api-reference`                          |

## Build Flow

1. Export `docs/static/openapi.json` from the service controller/Swagger metadata when the API changes.
2. Run AuthDocs and open the Redoc page.

```bash
yarn docs:openapi
yarn docs:dev
```

## Documentation Rules

| Rule             | Description                                                                       |
| ---------------- | --------------------------------------------------------------------------------- |
| Response schemas | Controller responses should have explicit schema definitions                      |
| Sensitive fields | Secrets, tokens, raw recovery codes, and key material must not appear in examples |
| Tenant paths     | Tenant-scoped APIs must include `/t/{tenantCode}`                                 |
| Admin APIs       | Admin APIs require authenticated admin context                                    |

## Troubleshooting

| Symptom             | Check                                                |
| ------------------- | ---------------------------------------------------- |
| Redoc page is blank | `docs/static/openapi.json` is included in the build  |
| Schema is missing   | Controller decorator or response schema registration |
| Stale schema        | Run `yarn docs:openapi`                              |
