---
title: Login
---

# Login

Path: `/login`

The Admin UI login screen authenticates an administrator and stores the admin session token for API calls.

## Flow

1. Open the Admin UI development server.
2. Enter admin credentials on `/login`.
3. On success, the UI navigates to `/admin/tenants`.

## API Handling

| Status | UI Behavior                                                      |
| ------ | ---------------------------------------------------------------- |
| `401`  | Clear authentication state and move to login                     |
| `403`  | Show insufficient permission feedback when already authenticated |

## Security Rules

- Do not log passwords or tokens.
- Do not embed client secrets in the frontend.
- Admin permissions are enforced by the service API.
