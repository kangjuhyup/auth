---
title: Redoc API Reference
description: How to view the service OpenAPI document with Redoc
---

# Redoc API Reference

The service exposes an OpenAPI document and AuthDocs renders it with Redoc.

## Local URLs

| Target               | URL                                  |
| -------------------- | ------------------------------------ |
| Service OpenAPI JSON | `http://localhost:3000/openapi.json` |
| AuthDocs Redoc page  | `/api-reference`                     |

## Build Flow

1. Run the service.
2. Open `/openapi.json` to verify the schema.
3. Run AuthDocs and open the Redoc page.

```bash
yarn service:dev
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
| Redoc page is blank | Service is running and `/openapi.json` is reachable  |
| Schema is missing   | Controller decorator or response schema registration |
| CORS/proxy issue    | Docs dev server proxy or direct service URL          |
