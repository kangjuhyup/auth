---
title: Consent
---

# Consent 조회

사용자 목록에서 audit 아이콘을 클릭하면 consent 모달이 열립니다.

| 탭 | 설명 |
| --- | --- |
| `Current` | 현재 활성 consent |
| `History` | revoked consent를 포함한 이력 |

각 consent 행을 펼치면 client와 scope 기반 상세 표시를 확인할 수 있습니다.

## 운영 기준

- consent 변경 이력은 audit log와 함께 추적합니다.
- 사용자가 동의한 scope와 client를 구분해서 확인합니다.
- revoked consent는 현재 권한이 아니므로 활성 consent와 분리해서 봅니다.
