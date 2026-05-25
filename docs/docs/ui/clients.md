---
title: Clients
---

# Clients

경로: `/admin/clients`

OIDC/OAuth client를 관리합니다. 상단에서 tenant를 먼저 선택해야 합니다.

## 주요 필드

| 필드 | 설명 |
| --- | --- |
| `Client ID` | OIDC `client_id`입니다. 생성 후 수정하지 않습니다. |
| `Name` | client 표시 이름입니다. |
| `Client Type` | `Public`, `Confidential`, `Service` 중 선택합니다. |
| `Enabled` | client 활성화 여부입니다. |
| `Redirect URIs` | authorization code flow callback URI입니다. |
| `Post Logout Redirect URIs` | logout 이후 허용할 redirect URI입니다. |
| `Grant Types` | 허용 grant type입니다. |
| `Response Types` | 허용 response type입니다. |
| `Allowed Scopes` | 허용 scope 문자열입니다. |
| `Token Endpoint Auth Method` | token endpoint client 인증 방식입니다. |

:::danger
client secret은 UI에 저장된 값을 다시 표시하지 않습니다. 수정 시 빈 값이면 기존 secret을 유지합니다.
:::

## Client Type 기준

| Type | 용도 | 인증 방식 |
| --- | --- | --- |
| `Public` | 브라우저/모바일 앱 | `none` |
| `Confidential` | 서버 사이드 앱 | `client_secret_basic` 또는 `client_secret_post` |
| `Service` | machine-to-machine 앱 | client secret 기반 인증 |
