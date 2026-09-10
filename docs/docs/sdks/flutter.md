---
title: Flutter SDK
description: Flutter 앱에서 Auth Platform의 표준 OIDC 로그인, 토큰 갱신과 로그아웃을 연동하는 방법
---

# Flutter SDK

`auth_platform_flutter`는 Flutter 앱을 self-hosted Auth Platform tenant에 연결하는 클라이언트 SDK입니다. Authorization Code Flow와 PKCE는 AppAuth에 위임하며, 앱이나 SDK가 사용자 비밀번호를 직접 수집하지 않습니다.

:::warning 개발 버전
현재 패키지는 `0.1.0-dev.1` 초기 스켈레톤이며 pub.dev에 배포되지 않았습니다. 공개 배포 전 저장소의 오픈소스 라이선스를 먼저 확정해야 합니다.
:::

## 지원 범위

| 기능      | SDK 동작                                                       |
| --------- | -------------------------------------------------------------- |
| 로그인    | 시스템 브라우저에서 Authorization Code + PKCE 시작             |
| 회원가입  | 서비스 앱/서버에서 완료한 뒤 SDK의 일반 OIDC 로그인으로 연결   |
| 토큰 보관 | `flutter_secure_storage`에 세션 전체를 하나의 값으로 저장      |
| 토큰 갱신 | 만료 전에 refresh token으로 갱신하며 동시 요청을 하나로 직렬화 |
| 로그아웃  | refresh/access token 폐기 후 RP-Initiated Logout 요청          |
| API 호출  | SDK가 반환한 API resource용 access token을 애플리케이션이 사용 |

SDK는 client secret을 받거나 전송하지 않으며, ID token을 직접 파싱하거나 OAuth/OIDC 프로토콜을 재구현하지 않습니다.

## Auth client 준비

관리자 UI에서 모바일 앱용 client를 다음 기준으로 등록합니다.

| 항목                       | 값                                                        |
| -------------------------- | --------------------------------------------------------- |
| Client type                | `public`                                                  |
| Token endpoint auth method | `none`                                                    |
| Grant types                | `authorization_code`, `refresh_token`                     |
| Response types             | `code`                                                    |
| Redirect URI               | 앱에 등록한 정확한 custom scheme 또는 app/universal link  |
| Post logout redirect URI   | 앱에 등록한 정확한 로그아웃 callback URI                  |
| Scope                      | 최소 `openid`; 필요에 따라 `profile email offline_access` |
| Resource                   | 호출할 API의 canonical HTTPS origin                       |

예를 들어 `https://api.example.com/path?x=1`이 아니라 `https://api.example.com`을 resource로 등록합니다.

## 패키지 설치

아직 pub.dev에 배포되지 않았으므로 Git dependency로 연결합니다.

```yaml
dependencies:
  auth_platform_flutter:
    git:
      url: https://github.com/kangjuhyup/auth.git
      path: sdks/flutter
      ref: main
```

SDK를 로컬에서 함께 개발할 때는 path dependency를 사용할 수 있습니다.

```yaml
dependencies:
  auth_platform_flutter:
    path: ../auth/sdks/flutter
```

## 초기화

앱 프로세스에서는 issuer/client 조합마다 하나의 `AuthClient` 인스턴스를 재사용합니다. 그래야 동시에 발생한 API 요청도 하나의 refresh 작업을 공유합니다.

```dart
import 'package:auth_platform_flutter/auth_platform_flutter.dart';

final config = AuthClientConfig(
  issuer: Uri.parse('https://auth.example.com/t/acme/oidc'),
  clientId: 'mobile-app',
  redirectUri: Uri.parse('com.example.app:/oauth/callback'),
  postLogoutRedirectUri: Uri.parse('com.example.app:/logout/callback'),
  resource: Uri.parse('https://api.example.com'),
);

final auth = AuthClient(
  config: config,
  authorizationGateway: AppAuthAuthorizationGateway(),
  sessionStore: SecureAuthSessionStore(storageKey: config.storageKey),
  tokenRevoker: HttpTokenRevoker(),
);
```

`issuer`는 tenant issuer 전체 경로여야 합니다. SDK는 이 값에 `/.well-known/openid-configuration`을 붙여 discovery 문서를 조회합니다.

## 로그인

```dart
final session = await auth.signIn();
```

`signIn()`은 시스템 브라우저를 열고 AppAuth가 Authorization Code 교환과 PKCE 검증을 처리하도록 합니다. 성공한 세션은 secure storage에 저장됩니다.

## 회원가입

사용자 등록 UI와 자격 정책은 서비스 앱/서버가 소유합니다. 서비스 서버는 자체 등록 정책을 확인한 뒤 tenant 범위의 Auth provisioning API로 credential을 만들고 `(issuer, subject)`를 자체 사용자 레코드에 연결합니다. 그 다음 앱은 `signIn()`으로 별도의 Authorization Code + PKCE 로그인을 시작합니다. SDK는 provisioning API, service client secret 또는 사용자 password를 다루지 않습니다.

:::info Signup API 경계
최종 사용자를 생성하는 API는 OIDC Core 규격의 일부가 아닙니다. 모바일 앱은 provisioning API를 직접 호출하지 않습니다. 정확한 서버 계약은 [서비스 사용자 Provisioning 운영](../operations/user-provisioning.md)을 따릅니다.
:::

## API access token

```dart
final accessToken = await auth.accessToken();
if (accessToken == null) {
  // 저장된 세션이 없거나 다시 인증해야 합니다.
}
```

`accessToken()`은 유효한 access token을 반환하고, 만료가 가까우면 저장된 refresh token으로 갱신합니다. 같은 프로세스에서 동시에 호출되면 rotating refresh token이 중복 사용되지 않도록 하나의 갱신 요청을 공유합니다.

API 요청에는 다음과 같이 bearer token을 전달합니다.

```dart
final response = await http.get(
  Uri.parse('https://api.example.com/votes'),
  headers: {'Authorization': 'Bearer $accessToken'},
);
```

API audience access token은 UserInfo token이 아닙니다. 로그인 사용자 정보에는 AppAuth가 검증한 `session.idToken` 결과를 사용하고, access token으로 UserInfo endpoint를 호출하지 않습니다.

## 로그아웃

```dart
await auth.signOut();
```

SDK는 가능한 경우 다음 순서로 로그아웃합니다.

1. refresh token 폐기
2. access token 폐기
3. RP-Initiated Logout 요청
4. 로컬 secure session 삭제

원격 폐기 중 오류가 발생해도 로컬 세션은 삭제됩니다. `postLogoutRedirectUri`를 설정하지 않으면 RP-Initiated Logout은 사용할 수 없습니다.

## Android redirect 설정

앱의 Android manifest 또는 Gradle manifest placeholder에 redirect scheme을 등록합니다. 다음 값은 예시이며 실제 client에 등록한 URI와 정확히 일치해야 합니다.

```text
com.example.app:/oauth/callback
com.example.app:/logout/callback
```

## iOS redirect 설정

`Info.plist`의 `CFBundleURLTypes`에 동일한 reverse-domain URL scheme을 등록합니다. Universal Link를 사용한다면 associated domains와 Auth client redirect URI도 함께 맞춥니다.

## 오류 처리

프로토콜 오류는 민감한 provider 응답을 포함하지 않는 `AuthProtocolException`으로 전달됩니다.

```dart
try {
  await auth.signIn();
} on AuthProtocolException catch (error) {
  switch (error.code) {
    case 'user_cancelled':
      // 사용자가 브라우저 인증을 취소했습니다.
      break;
    case 'invalid_grant':
      // 기존 token chain을 사용할 수 없어 다시 로그인해야 합니다.
      break;
    default:
      // 안전한 일반 오류 화면을 표시합니다.
      break;
  }
}
```

토큰, authorization code, client secret, provider의 상세 오류 응답을 로그로 출력하지 마세요.

## 전체 예제

실행 가능한 최소 예제는 저장소의 [`sdks/flutter/example`](https://github.com/kangjuhyup/auth/tree/main/sdks/flutter/example)에 있습니다. Android/iOS host 파일은 애플리케이션에서 사용하는 Flutter 버전으로 생성한 뒤 redirect 설정을 적용합니다.
