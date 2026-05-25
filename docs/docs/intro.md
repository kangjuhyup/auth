---
sidebar_position: 1
title: 문서 개요
slug: /
---

# Auth Docs

Auth Docs는 OIDC Authorization Server와 관리자 UI 운영을 위한 문서 포털입니다.

## 문서 구성

| 영역 | 내용 |
| --- | --- |
| UI 사용 가이드 | 관리자 콘솔 화면별 사용법과 운영 절차 |
| API 문서 | OpenAPI / Redoc 기반 API Reference 연결 지점 |
| 운영 주의사항 | secret, token, recovery code 등 민감정보 처리 기준 |

## 실행

```bash
yarn docs:dev
```

기본 개발 서버는 `http://localhost:3100`에서 실행됩니다.

## 빌드

```bash
yarn docs:build
```

빌드 결과물은 `docs/build/`에 생성됩니다.
