---
title: Redoc API Reference
---

import Link from '@docusaurus/Link';

# Redoc API Reference

Redoc은 OpenAPI 스펙 기반 API Reference에 사용합니다. service는 OpenAPI JSON만 노출하고, Redoc UI는 Auth Docs 문서 본문과 분리된 별도 API Reference 화면에서 렌더링합니다.

## 로컬 URL

| 문서           | URL                                        |
| -------------- | ------------------------------------------ |
| OpenAPI JSON   | `http://localhost:3000/openapi.json`       |
| API Reference  | `http://localhost:3100/auth/api-reference` |
| Auth Docs 링크 | `http://localhost:3100/auth/api/redoc`     |

## API Reference 열기

service와 Auth Docs를 실행한 뒤 별도 API Reference 화면에서 Redoc을 확인할 수 있습니다. 기본 spec URL은 `http://localhost:3000/openapi.json`입니다.

<Link
  className="button button--primary"
  to="/api-reference"
  target="_blank"
  rel="noreferrer"
>
  API Reference 열기
</Link>

## 운영 설정

service OpenAPI JSON 기본 동작:

- `NODE_ENV=production`이면 OpenAPI JSON을 노출하지 않습니다.
- `OPENAPI_DOCS_ENABLED=true`이면 production에서도 명시적으로 OpenAPI JSON을 노출합니다.
- `OPENAPI_DOCS_ENABLED=false`이면 환경과 관계없이 비활성화합니다.
- Auth Docs에서 Redoc을 보려면 service의 OpenAPI JSON CORS origin에 docs 주소가 포함되어야 합니다. 개발 환경에서는 `http://localhost:3100`과 `http://127.0.0.1:3100`을 기본 허용합니다.
- production에서 Auth Docs와 연동하려면 `OPENAPI_DOCS_ENABLED=true`, `OPENAPI_CORS_ORIGINS=https://kangjuhyup.github.io`처럼 문서 origin을 명시하세요.

:::warning
Redoc은 admin API 구조도 포함할 수 있습니다. 운영 환경에서는 문서 노출 정책을 명시적으로 결정하세요.
:::
