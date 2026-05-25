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

1. Update `docs/static/openapi.json` from the service when the API changes.
2. Run AuthDocs and open the Redoc page.

```bash
curl http://localhost:3000/openapi.json -o docs/static/openapi.json
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
| Stale schema        | Refresh `docs/static/openapi.json` from the service  |
