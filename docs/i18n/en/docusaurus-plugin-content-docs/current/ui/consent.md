---
title: Consent
---

# Consent

Consent records represent what scopes a user has allowed for a client.

## When Consent Appears

| Situation                         | Behavior                                |
| --------------------------------- | --------------------------------------- |
| New requested scope               | Show consent screen                     |
| Existing consent                  | Existing Grant may be reused            |
| Trusted client with `skipConsent` | Consent can be skipped if policy allows |

## Operating Rules

- Keep consent enabled for external clients.
- Review scope meaning before skipping consent.
- Do not log raw tokens or sensitive user data.

Related concept: [Scope Overview](../concepts/client/scopes/overview.md).
