---
title: Redoc API Reference
---

import Link from '@docusaurus/Link';

# Redoc API Reference

Redoc은 OpenAPI 스펙 기반 API Reference에 사용합니다. Auth Docs는 배포 시 service에 직접 요청하지 않고, `docs/static/openapi.json`에 포함된 정적 OpenAPI JSON을 기준으로 Redoc UI를 렌더링합니다.

## 로컬 URL

| 문서           | URL                                        |
| -------------- | ------------------------------------------ |
| OpenAPI JSON   | `http://localhost:3100/auth/openapi.json`  |
| API Reference  | `http://localhost:3100/auth/api-reference` |
| Auth Docs 링크 | `http://localhost:3100/auth/api/redoc`     |

## API Reference 열기

Auth Docs를 실행한 뒤 별도 API Reference 화면에서 Redoc을 확인할 수 있습니다. 기본 spec URL은 Auth Docs에 포함된 `/openapi.json`입니다.

<Link
  className="button button--primary"
  to="/api-reference"
  target="_blank"
  rel="noreferrer"
>
  API Reference 열기
</Link>

## OpenAPI JSON 갱신

service의 최신 OpenAPI JSON을 문서에 반영하려면 service를 실행한 뒤 정적 JSON 파일을 갱신합니다.

```bash
curl http://localhost:3000/openapi.json -o docs/static/openapi.json
```

운영 배포된 Auth Docs는 이 파일을 정적 asset으로 제공합니다.

:::warning
Redoc은 admin API 구조도 포함할 수 있습니다. 공개 저장소나 GitHub Pages에 배포하기 전에 노출 가능한 API 스펙인지 검토하세요.
:::
