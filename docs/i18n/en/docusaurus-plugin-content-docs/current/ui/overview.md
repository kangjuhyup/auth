---
title: Overview
---

# Admin UI Overview

The Admin UI is the console for operating tenants, clients, identity providers, users, access control, consent, audit logs, and policies.

## Run

```bash
yarn workspace @auth/ui dev
```

The development environment usually uses `ui/.env.development`.

```env
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=/api
```

The service API is reached through the Vite proxy or the same-origin `/api` path.

## Layout

| Area         | Role                                   |
| ------------ | -------------------------------------- |
| Left sidebar | Feature navigation                     |
| Header       | Tenant selector, current user, logout  |
| Content      | List, detail, create, and update views |

Most admin screens support list lookup, pagination, create, update, and delete actions.
