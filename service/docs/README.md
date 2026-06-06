# Auth Service Docs

`service/docs`는 백엔드 개발자와 운영자를 위한 로컬 문서입니다. 사용자/운영자 대상 포털 문서는 [Auth Docs](../../docs/docs/intro.md)를 원본으로 관리합니다.

## 로컬 문서

| 문서                                        | 설명                                           |
| ------------------------------------------- | ---------------------------------------------- |
| [OIDC Overview](./OIDC.md)                  | `node-oidc-provider` 연동 구조와 tenant issuer |
| [OIDC Custom Grant](./OIDC_CUSTOM_GRANT.md) | 커스텀 OAuth `grant_type` 및 OIDC `Grant` 확장 |
| [Database](./DATABASE.md)                   | DB 설정과 마이그레이션                         |
| [Logging](./LOGGING.md)                     | 로깅 정책                                      |
| [Metrics](./METRICS.md)                     | 메트릭 정책                                    |
| [Notification](./NOTIFICATION.md)           | 메일/SMS 알림 채널                             |

## AuthDocs 연결

| 문서                                                             | 설명                         |
| ---------------------------------------------------------------- | ---------------------------- |
| [OIDC 인증 흐름](../../docs/docs/concepts/oidc-flow.md)          | OIDC 흐름 설명               |
| [커스텀 Grant](../../docs/docs/concepts/client/grants/custom.md) | AuthDocs용 커스텀 grant 문서 |
| [Tenant 정책](../../docs/docs/concepts/tenant/policies.md)       | tenant 기본 정책             |
| [Client 정책](../../docs/docs/concepts/client/policies.md)       | client auth policy 개념      |
| [Grant 개요](../../docs/docs/concepts/client/grants/overview.md) | client `grantTypes` 정책     |
| [Scope 개요](../../docs/docs/concepts/client/scopes.md)          | scope와 resource indicator   |
