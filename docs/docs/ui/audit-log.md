---
title: Audit Log
---

# Audit Log

관리자 작업, 보안 이벤트, 인증 실패, token reuse, key rotation 이력을 조회합니다.

## 주요 필터

| 필터 | 설명 |
| --- | --- |
| 기간 | 이벤트 발생 시각 범위를 제한합니다. |
| tenantId | tenant 기준으로 필터링합니다. |
| userId | 사용자 기준으로 필터링합니다. |
| clientId | OIDC client 기준으로 필터링합니다. |
| action | 행위 종류를 기준으로 필터링합니다. |
| severity | 위험도 기준으로 필터링합니다. |
| correlationId | 동일 요청 흐름의 이벤트를 추적합니다. |

## 확인 대상

- client 인증 실패
- refresh token reuse
- key rotation
- consent 변경
- admin 작업
- 권한 부족 또는 접근 차단
