# Admin UI Docs

`ui/`는 관리자 콘솔 애플리케이션입니다. 화면별 사용법과 운영 문서는 Auth Docs의 Markdown 문서를 원본으로 관리합니다.

## 문서 위치

| 문서                                                           | 설명                          |
| -------------------------------------------------------------- | ----------------------------- |
| [관리자 UI 개요](../../docs/docs/ui/overview.md)               | 공통 화면 구조와 실행 방식    |
| [Tenants](../../docs/docs/ui/tenants.md)                       | tenant 생성, 선택, 설정       |
| [Clients](../../docs/docs/ui/clients.md)                       | OIDC/OAuth client 관리        |
| [Tenant Policies](../../docs/docs/ui/policies.md)              | tenant 수정 화면의 정책 설정  |
| [Identity Providers](../../docs/docs/ui/identity-providers.md) | OAuth2/SAML IdP 연결          |
| [Access](../../docs/docs/ui/access.md)                         | 사용자, 그룹, 역할, 권한 관리 |
| [Consent](../../docs/docs/ui/consent.md)                       | 사용자 consent 관리           |
| [Audit Log](../../docs/docs/ui/audit-log.md)                   | 감사 로그 조회                |
| [Security](../../docs/docs/ui/security.md)                     | 관리자 UI 보안 동작           |
| [Operations](../../docs/docs/ui/operations.md)                 | 운영 점검 항목                |

## 관련 개념

| 문서                                                             | 설명                       |
| ---------------------------------------------------------------- | -------------------------- |
| [핵심 개념](../../docs/docs/concepts.md)                         | Tenant, Client, RBAC 관계  |
| [Tenant 개요](../../docs/docs/concepts/tenant/overview.md)       | tenant 보안 경계와 issuer  |
| [Tenant 정책](../../docs/docs/concepts/tenant/policies.md)       | tenant 기본 정책           |
| [Client 개요](../../docs/docs/concepts/client/overview.md)       | client 타입과 주요 속성    |
| [Client 정책](../../docs/docs/concepts/client/policies.md)       | client별 인증 정책         |
| [Grant 개요](../../docs/docs/concepts/client/grants/overview.md) | client grant type 정책     |
| [Scope 개요](../../docs/docs/concepts/client/scopes/overview.md) | scope와 resource indicator |

## 개발 실행

```bash
yarn workspace @auth/ui dev
```

기본 개발 설정은 `ui/.env.development`를 사용합니다.

```env
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=/api
```
