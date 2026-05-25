---
title: Security
---

# Security

This page summarizes security behavior visible from the Admin UI. For MFA concepts and enrollment flow, see [MFA Overview](../concepts/mfa.md).

## Auth Handling

| Case                        | Behavior                              |
| --------------------------- | ------------------------------------- |
| Unauthenticated             | Move to login                         |
| Authenticated but forbidden | Show insufficient permission feedback |
| Session expired             | Clear auth state and require login    |

## Sensitive Data

- Client secrets are not displayed after storage.
- Tokens and passwords must not be logged.
- Recovery codes and MFA secrets must not be exposed in UI logs.

## Tenant Boundary

Tenant-scoped screens require a selected tenant. API calls include tenant code in the path and the service enforces tenant binding.
