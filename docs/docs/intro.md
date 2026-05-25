---
sidebar_position: 1
title: 문서 개요
slug: /
---

# Auth Docs

Auth Docs는 OIDC Authorization Server와 관리자 UI 운영을 위한 문서 포털입니다.

## 문서 구성

| 영역           | 내용                                                                               |
| -------------- | ---------------------------------------------------------------------------------- |
| 핵심 개념      | Tenant, Client, RBAC, OIDC 인증 흐름, MFA, IdP, Client Grant, Tenant / Client 정책 |
| 관리자 UI      | 관리자 콘솔 화면별 사용법과 운영 절차                                              |
| Interaction UI | OIDC 로그인·동의·MFA 화면 커스터마이징                                             |
| API            | OpenAPI / Redoc API Reference                                                      |
| 운영 주의사항  | secret, token, recovery code 등 민감정보 처리 기준                                 |

## 먼저 볼 문서

| 문서                                                  | 설명                                                                  |
| ----------------------------------------------------- | --------------------------------------------------------------------- |
| [핵심 개념](./concepts.md)                            | Tenant, Client, RBAC의 의미와 관계                                    |
| [문서 맵](./document-map.md)                          | AuthDocs와 각 워크스페이스 로컬 문서의 위치                           |
| [OIDC 인증 흐름](./concepts/oidc-flow.md)             | Authorization Code + PKCE 기준 전체 인증 흐름과 interaction 처리 구조 |
| [Tenant 개요](./concepts/tenant/overview.md)          | tenant 보안 경계, issuer, 분리 범위                                   |
| [Tenant 정책](./concepts/tenant/policies.md)          | tenant 기본 인증, MFA, 세션, 가입 정책                                |
| [Client 개요](./concepts/client/overview.md)          | client 타입, redirect URI, logout URI 등 주요 속성                    |
| [Client 정책](./concepts/client/policies.md)          | client별 인증 정책과 effective policy                                 |
| [Grant 개요](./concepts/client/grants/overview.md)    | client에 허용하는 OAuth/OIDC grant type 정책                          |
| [커스텀 Grant](./concepts/client/grants/custom.md)    | 커스텀 OAuth `grant_type` 추가 절차                                   |
| [Scope 개요](./concepts/client/scopes.md)             | scope와 resource indicator 의미                                       |
| [MFA 개요](./concepts/mfa.md)                         | MFA 정책, enrollment, 인증 흐름                                       |
| [IdP 개요](./concepts/idp.md)                         | 외부 Identity Provider와 OAuth2/SAML 연동                             |
| [커스텀 IdP](./concepts/idp/custom.md)                | OAuth2/OIDC 스타일, SAML 2.0 커스텀 IdP 추가 기준                     |
| [Interaction UI 커스터마이징](./ui/interaction-ui.md) | 로그인, 동의, MFA 화면 수정 지점과 빌드 절차                          |
| [Redoc API 문서](./api/redoc.md)                      | 서비스 OpenAPI 문서 확인 방법                                         |

## 실행

```bash
yarn docs:dev
```

기본 개발 서버는 `http://localhost:3100`에서 실행됩니다.

## 빌드

```bash
yarn docs:build
```

정적 결과물은 `docs/build/` 아래에 생성됩니다.
