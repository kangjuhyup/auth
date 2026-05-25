---
title: 개요
---

# UI 사용 가이드 개요

관리자 UI는 tenant, client, 외부 IdP, 사용자, 권한, consent, audit log를 운영하기 위한 콘솔입니다.

## 기본 실행

```bash
yarn workspace @auth/ui dev
```

개발 환경은 기본적으로 `ui/.env.development`를 사용합니다.

```env
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=/api
```

서비스 API는 Vite proxy 또는 동일 origin의 `/api` 경로로 접근합니다.

## 공통 화면 구조

| 영역 | 역할 |
| --- | --- |
| 왼쪽 사이드바 | 기능 메뉴를 제공합니다. |
| 상단 헤더 | tenant 선택, 현재 사용자, 로그아웃을 제공합니다. |
| 본문 | 선택한 메뉴의 목록, 상세, 생성, 수정 화면을 표시합니다. |

대부분의 관리 화면은 목록 조회, 페이지네이션, 생성, 수정, 삭제를 지원합니다.
