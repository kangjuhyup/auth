---
title: Redoc API Reference
---

# Redoc API Reference

Redoc은 OpenAPI 스펙 기반 API Reference에 사용합니다. service 실행 시 OpenAPI JSON과 Redoc UI가 함께 노출됩니다.

## 로컬 URL

| 문서 | URL |
| --- | --- |
| OpenAPI JSON | `http://localhost:3000/openapi.json` |
| Redoc UI | `http://localhost:3000/redoc` |

## Docusaurus에서 보기

service를 실행한 뒤 아래 문서 뷰에서 Redoc 화면을 바로 확인할 수 있습니다.

<iframe
  src="http://localhost:3000/redoc"
  title="Auth API Redoc"
  style={{ width: '100%', height: '900px', border: '1px solid #d8dee8', borderRadius: '8px' }}
/>

## 운영 설정

기본 동작:

- `NODE_ENV=production`이면 OpenAPI/Redoc 문서를 노출하지 않습니다.
- `OPENAPI_DOCS_ENABLED=true`이면 production에서도 명시적으로 노출합니다.
- `OPENAPI_DOCS_ENABLED=false`이면 환경과 관계없이 비활성화합니다.

:::warning
Redoc은 admin API 구조도 포함할 수 있습니다. 운영 환경에서는 문서 노출 정책을 명시적으로 결정하세요.
:::
