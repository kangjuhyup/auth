---
title: Tenant / Client 정책
---

# Tenant / Client 정책

Tenant 기본 정책은 service API의 `/t/{tenantCode}/admin/policies`에서 조회/수정합니다.

## Tenant 정책 예시

```json
{
  "password": {
    "minLength": 14,
    "requireUppercase": true,
    "requireLowercase": true,
    "requireNumber": true,
    "requireSymbol": true,
    "preventReuseCount": 10,
    "expiresInDays": 90,
    "lockoutFailureThreshold": 5,
    "lockoutDurationSec": 900
  },
  "mfa": {
    "required": true,
    "adminRequired": true
  },
  "allowedIdp": {
    "providerKeys": ["google", "okta-workforce"]
  },
  "refreshToken": {
    "ttlSec": 1209600,
    "rotationEnabled": true,
    "reuseAction": "revoke_grant"
  }
}
```

## Client별 override

Client별 override는 `/t/{tenantCode}/admin/clients/{clientId}/auth-policy`에서 조회/수정합니다.

## 우선순위

- Tenant 정책은 기본값입니다.
- Client 정책에 값이 있으면 client별 override가 우선합니다.
- tenant MFA 필수 또는 `requireAuthTime`이 켜져 있으면 client에서 끌 수 없습니다.
- client auth policy 응답의 `effective` 필드에서 실제 적용값을 확인합니다.
