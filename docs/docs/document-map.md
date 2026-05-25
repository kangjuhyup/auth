---
title: 문서 맵
description: AuthDocs와 각 워크스페이스 로컬 문서의 역할과 위치
---

# 문서 맵

AuthDocs는 이 저장소의 사용자/운영자 대상 문서 포털입니다. Markdown 원본은 `docs/docs`에 두고, 각 워크스페이스의 `docs` 디렉토리는 해당 앱을 개발하거나 운영할 때 바로 필요한 로컬 문서만 둡니다.

## 문서 위치 원칙

| 위치                          | 역할                                                          | 예                                                       |
| ----------------------------- | ------------------------------------------------------------- | -------------------------------------------------------- |
| `docs/docs`                   | AuthDocs 원본. 개념, 관리자 UI, Interaction UI, API 사용 문서 | Tenant 개념, OIDC 인증 흐름, Client Grant, 화면별 사용법 |
| `service/docs`                | 백엔드 개발자용 운영/구현 문서                                | OIDC provider 구조, DB, logging, metrics                 |
| `ui/docs`                     | 관리자 UI 개발자용 로컬 인덱스                                | AuthDocs UI 문서 링크, 개발 실행                         |
| `service/interaction-ui/docs` | Interaction UI 앱 커스터마이징 문서                           | 빌드, 정적 서빙, prompt 화면 수정                        |
| `README.md`                   | 저장소 진입점                                                 | 빠른 시작, 문서 링크                                     |

## AuthDocs

| 문서                                               | 설명                                               |
| -------------------------------------------------- | -------------------------------------------------- |
| [문서 개요](./intro.md)                            | Auth Docs 시작점                                   |
| [핵심 개념](./concepts.md)                         | Tenant, Client, RBAC, MFA, IdP 관계                |
| [OIDC 인증 흐름](./concepts/oidc-flow.md)          | Authorization Code + PKCE 흐름                     |
| [Tenant 개요](./concepts/tenant/overview.md)       | tenant 보안 경계, issuer, 분리 범위                |
| [Tenant 정책](./concepts/tenant/policies.md)       | tenant 기본 인증, MFA, 세션, 가입 정책             |
| [Client 개요](./concepts/client/overview.md)       | client 타입, redirect URI, logout URI 등 주요 속성 |
| [Client 정책](./concepts/client/policies.md)       | client별 인증 정책과 effective policy              |
| [Grant 개요](./concepts/client/grants/overview.md) | client grant type 정책                             |
| [커스텀 Grant](./concepts/client/grants/custom.md) | 커스텀 `grant_type` 추가 절차                      |
| [Scope 개요](./concepts/client/scopes.md)          | scope와 resource indicator                         |
| [MFA 개요](./concepts/mfa.md)                      | MFA 정책, enrollment, 인증 흐름                    |
| [IdP 개요](./concepts/idp.md)                      | 외부 Identity Provider와 OAuth2/SAML 연동          |
| [커스텀 IdP](./concepts/idp/custom.md)             | OAuth2/OIDC 스타일, SAML 2.0 커스텀 IdP 추가 기준  |
| [Redoc API 문서](./api/redoc.md)                   | OpenAPI / Redoc 확인 방법                          |

## 관리자 UI

| 문서                                             | 설명                          |
| ------------------------------------------------ | ----------------------------- |
| [관리자 UI 개요](./ui/overview.md)               | 공통 화면 구조와 실행 방식    |
| [Tenants](./ui/tenants.md)                       | tenant 생성, 선택, 설정       |
| [Clients](./ui/clients.md)                       | OIDC/OAuth client 관리        |
| [Tenant Policies](./ui/policies.md)              | tenant 정책 화면 사용법       |
| [Identity Providers](./ui/identity-providers.md) | OAuth2/SAML IdP 연결          |
| [Access](./ui/access.md)                         | 사용자, 그룹, 역할, 권한 관리 |
| [Consent](./ui/consent.md)                       | 사용자 consent 관리           |
| [Audit Log](./ui/audit-log.md)                   | 감사 로그 조회                |
| [Security](./ui/security.md)                     | 관리자 UI 보안 동작           |
| [Operations](./ui/operations.md)                 | 운영 점검 항목                |

## Interaction UI

| 문서                                                  | 설명                                         |
| ----------------------------------------------------- | -------------------------------------------- |
| [Interaction UI 커스터마이징](./ui/interaction-ui.md) | AuthDocs용 화면 수정 가이드                  |
| `service/interaction-ui/docs/CUSTOMIZATION.md`        | 앱 소스 기준 상세 파일 경로와 빌드/서빙 구조 |

## 서비스 로컬 문서

| 문서                           | 설명                         |
| ------------------------------ | ---------------------------- |
| `service/README.md`            | 백엔드 구조와 실행           |
| `service/docs/README.md`       | 백엔드 로컬 문서 목록        |
| `service/docs/OIDC.md`         | node-oidc-provider 연동 구조 |
| `service/docs/DATABASE.md`     | DB 설정과 마이그레이션       |
| `service/docs/LOGGING.md`      | 로깅 정책                    |
| `service/docs/METRICS.md`      | 메트릭 정책                  |
| `service/docs/NOTIFICATION.md` | 알림 채널                    |

## UI 로컬 문서

| 문서                               | 설명                           |
| ---------------------------------- | ------------------------------ |
| `ui/docs/README.md`                | 관리자 UI 개발자용 문서 인덱스 |
| `service/interaction-ui/README.md` | Interaction UI 앱 진입점       |
