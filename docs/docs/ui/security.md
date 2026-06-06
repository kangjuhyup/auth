---
title: Security
---

# Security

경로: `/admin/security`

현재 로그인한 사용자의 계정 보안 설정을 관리합니다.

MFA 개념과 정책 적용 기준은 [MFA 개요](../concepts/mfa.md)를 참고하세요.

## Authenticator app

1. `Start enrollment`를 누릅니다.
2. 표시된 secret 또는 OTP auth URL을 인증 앱에 등록합니다.
3. 인증 앱의 6자리 코드를 입력합니다.
4. `Confirm`을 누릅니다.
5. 발급된 recovery code를 안전한 곳에 보관합니다.

## Recovery codes

1. `Recovery codes`에서 남은 코드 수, 전체 코드 수, 사용된 코드 수를 확인합니다.
2. `Low` 상태가 표시되면 `Regenerate codes`를 누릅니다.
3. 확인 팝업에서 재발급을 승인합니다.
4. 새로 표시된 recovery code를 안전한 곳에 보관합니다.

:::danger
recovery code는 발급 직후에만 표시됩니다. 재발급하면 기존 recovery code는 모두 폐기됩니다.
:::

## Connected identity providers

현재 계정에 연결된 외부 IdP 목록을 확인합니다.

- provider 이름
- 연결 이메일
- 연결 날짜

외부 IdP 인증이 끝나면 `/admin/security`로 돌아오며 연결 목록이 갱신됩니다.
