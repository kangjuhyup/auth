---
title: Audit Log
---

# Audit Log

Audit logs track administrator actions and security-relevant events.

## Typical Events

| Event                | Description                                          |
| -------------------- | ---------------------------------------------------- |
| Client change        | Create, update, delete, or policy change             |
| Tenant policy change | MFA, session, signup, or refresh policy update       |
| Consent change       | User consent update or revocation                    |
| Security signal      | Login failures, replay/reuse detection, key rotation |

## Logging Rules

- Include tenant, resource type, resource ID, actor, and correlation ID when possible.
- Do not log tokens, authorization codes, secrets, recovery codes, or raw key material.
- Use audit logs to reconstruct operational changes.
