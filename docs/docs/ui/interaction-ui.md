---
title: Interaction UI 커스터마이징
description: OIDC interaction 화면의 구조, 수정 지점, 빌드 및 검증 절차
---

# Interaction UI 커스터마이징

| 항목           | 내용                                                                              |
| -------------- | --------------------------------------------------------------------------------- |
| 문서 목적      | 로그인, 동의, MFA 등 OIDC interaction 화면을 안전하게 수정하는 절차를 정의합니다. |
| 대상 독자      | 프론트엔드 개발자, 인증 플로우 담당자                                             |
| 원본 운영 문서 | `service/interaction-ui/docs/CUSTOMIZATION.md`                                    |
| 주요 코드 위치 | `service/interaction-ui`                                                          |

## 개요

Interaction UI는 OIDC authorize 흐름 중 사용자가 직접 보는 로그인, 동의, MFA 화면을 담당하는 React SPA입니다. 화면은 `service/interaction-ui`에서 빌드되고, Nest 서비스가 `/interaction-assets`와 `/t/:tenantCode/interaction/:uid` 경로로 서빙합니다.

:::info
관리자 UI와 Interaction UI는 목적이 다릅니다. 관리자 UI는 운영자가 설정을 관리하는 도구이고, Interaction UI는 최종 사용자가 OIDC 인증 중 만나는 화면입니다.
:::

## 적용 범위

| 구분                             | 포함 여부   | 설명                                                                    |
| -------------------------------- | ----------- | ----------------------------------------------------------------------- |
| 로그인 화면 문구와 레이아웃 변경 | 포함        | `LoginPage.tsx`, `index.css`                                            |
| 외부 IdP 버튼 표현 변경          | 포함        | `IdpButton.tsx`, `LoginPage.tsx`                                        |
| MFA 인증 및 TOTP 등록 화면 변경  | 포함        | `MfaPage.tsx`, `MfaEnrollmentPage.tsx`                                  |
| 새 interaction prompt 추가       | 조건부 포함 | `App.tsx`, `InteractionController`, provider interaction 흐름 동시 수정 |
| OIDC protocol 처리 재구현        | 제외        | `node-oidc-provider`에 위임                                             |

## 서빙 구조

| 구성요소                                                         | 책임                                              |
| ---------------------------------------------------------------- | ------------------------------------------------- |
| `service/interaction-ui/vite.config.ts`                          | `/interaction-assets/` base로 정적 자산 경로 생성 |
| `service/interaction-ui/src/api/client.ts`                       | 현재 pathname 기준으로 interaction API 호출       |
| `service/src/app.module.ts`                                      | `/interaction-assets` 정적 파일 서빙              |
| `service/src/presentation/controllers/interaction.controller.ts` | interaction SPA HTML과 API 제공                   |

브라우저 진입 경로:

```text
{OIDC_ISSUER}/t/{tenantCode}/interaction/{uid}
```

Interaction UI가 호출하는 주요 API:

```text
GET  ./api/details
POST ./api/login
POST ./api/mfa
POST ./api/mfa/totp/enroll
POST ./api/mfa/totp/confirm
POST ./api/consent
GET  ./api/abort
GET  ./idp/:provider
```

## 수정 지점

| 파일                              | 수정 대상                               |
| --------------------------------- | --------------------------------------- |
| `src/index.css`                   | 색상, 폼, 카드, 버튼, QR, 반응형 스타일 |
| `src/App.tsx`                     | prompt별 페이지 전환, 로그인 후 분기    |
| `src/pages/LoginPage.tsx`         | ID/PW 로그인, 외부 IdP 버튼 목록        |
| `src/pages/ConsentPage.tsx`       | scope 동의 화면                         |
| `src/pages/MfaPage.tsx`           | MFA 인증 화면                           |
| `src/pages/MfaEnrollmentPage.tsx` | TOTP 등록 QR, 설정 키, 복구 코드        |
| `src/components/IdpButton.tsx`    | 외부 IdP 버튼 표현                      |
| `src/api/client.ts`               | interaction API 타입과 호출             |

## 커스터마이징 절차

1. 변경 대상이 문구, 스타일, 화면 흐름, API 계약 중 어디에 해당하는지 분류합니다.
2. 문구와 스타일만 바꿀 때는 `pages/*`, `components/*`, `index.css`만 수정합니다.
3. 응답 필드가 바뀌면 `api/client.ts` 타입과 `App.tsx` 분기를 함께 수정합니다.
4. 새 API가 필요하면 `InteractionController`에 endpoint를 추가하고, 프론트 API client를 맞춥니다.
5. 새 prompt를 추가할 때는 provider interaction 흐름과 `App.tsx` 분기를 함께 설계합니다.
6. 빌드 후 Nest 오리진에서 실제 OIDC 흐름으로 검증합니다.

## MFA 등록 화면

TOTP enrollment 응답은 `secret`과 `otpauthUrl`을 반환합니다. UI는 `otpauthUrl`을 QR 코드로 표시하고, 수동 입력을 위한 설정 키를 함께 보여줍니다.

| 점검 항목        | 설명                                                         |
| ---------------- | ------------------------------------------------------------ |
| QR 미표시        | `beginTotpEnrollment()` 응답의 `otpauthUrl` 존재 여부 확인   |
| 계속 버튼 비활성 | `confirmTotpEnrollment()` 응답의 `redirectTo` 존재 여부 확인 |
| 보안 로그        | `otpauthUrl`, `secret`, recovery code 원문 로그 금지         |

## 빌드와 검증

```bash
yarn interaction-ui:build
yarn workspace @auth/service build
```

`service/interaction-ui/dist`는 로컬 빌드 산출물입니다. Git에는 올리지 않습니다.

## 문제 해결

| 증상                                          | 확인 지점                                                            |
| --------------------------------------------- | -------------------------------------------------------------------- |
| 화면 대신 `Interaction UI not built`가 반환됨 | `yarn interaction-ui:build` 실행 여부                                |
| JS/CSS 404 발생                               | Vite `base`와 Nest `serveRoot`가 모두 `/interaction-assets`인지 확인 |
| API가 다른 포트로 호출됨                      | Vite dev server 단독 실행 여부, proxy 설정 여부                      |
| 로그인 후 MFA 등록 화면으로 이동하지 않음     | `/api/login` 응답의 `mfaEnrollmentRequired`와 `App.tsx` 분기 확인    |
| 외부 IdP 버튼 클릭 후 404                     | `details.idpList`, `GET ./idp/:provider` 라우팅 확인                 |
