# Interaction UI

`service/interaction-ui`는 OIDC authorize 흐름 중 최종 사용자가 보는 로그인, 동의, MFA 화면입니다. Vite + React 앱으로 빌드되며, Nest 서비스가 같은 오리진에서 정적 파일과 interaction HTML을 서빙합니다.

## 문서

| 문서                                                            | 설명                                                  |
| --------------------------------------------------------------- | ----------------------------------------------------- |
| [커스터마이징](./docs/CUSTOMIZATION.md)                         | 앱 소스 기준 빌드, 서빙, API 계약, 화면 수정 지점     |
| [AuthDocs Interaction UI](../../docs/docs/ui/interaction-ui.md) | 운영자/프론트엔드 담당자용 요약 가이드                |
| [OIDC 인증 흐름](../../docs/docs/api/oidc-flow.md)              | authorize부터 interaction, token 교환까지의 전체 흐름 |

## 빌드

```bash
yarn interaction-ui:build
```

`dist`는 빌드 산출물이므로 Git에 올리지 않습니다.
