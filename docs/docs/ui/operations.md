---
title: 운영 주의사항
---

# 운영 주의사항

## 민감정보

- UI에는 client secret, token, recovery code 원문을 지속 저장하지 않습니다.
- API 오류 메시지는 사용자에게 표시하되 token/secret 값을 포함하지 않습니다.
- authorization code, access token, IdP token 응답은 UI에 저장하지 않습니다.

## OIDC 흐름

- OIDC authorization/token 흐름은 UI에서 직접 구현하지 않습니다.
- backend authorization endpoint로 redirect합니다.
- JWT를 UI에서 수동 파싱하거나 검증하지 않습니다.

## 상태 관리

- 서버 데이터는 TanStack Query 캐시로 관리합니다.
- Zustand는 tenant 선택, modal open 상태, 사이드바 접힘 상태 같은 UI 상태에만 사용합니다.
- 서버 authoritative 데이터를 Zustand에 중복 저장하지 않습니다.
