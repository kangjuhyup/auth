# Auth Platform Flutter SDK

Flutter integration for a self-hosted Auth Platform tenant. The SDK delegates
OAuth 2.0 and OpenID Connect protocol behavior to AppAuth. It does not collect
passwords, embed a client secret, parse ID tokens manually, or implement PKCE.

## Status

This package is an initial `0.1.0-dev.1` skeleton. Its public contract may
change before the first stable release.

## Usage

Register a `public` client with `token_endpoint_auth_method: none`, response
type `code`, grant types `authorization_code` and `refresh_token`, and the exact
mobile redirect and post-logout redirect URIs.

```dart
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

final session = await auth.signIn();
final accessToken = await auth.accessToken();
await auth.signOut();
```

To start the hosted account-creation experience, call `auth.signUp()`. The SDK
sends the standard OIDC `prompt=create` authorization request; credentials stay
inside the authorization server's browser interaction.

Use `session.idToken` only as the verified login result supplied by AppAuth.
Use `accessToken` only for the configured API resource. An API-audience access
token is not a UserInfo token.

Keep one `AuthClient` instance per issuer/client pair. This lets concurrent API
requests share one refresh operation so a rotating refresh token is not reused
in parallel inside the app process.

## Platform redirects

AppAuth requires the redirect scheme to be registered in Android and iOS
application metadata. See [`example/README.md`](example/README.md) for the
minimal host-app setup.

## Security boundaries

- The issuer must use HTTPS, except loopback development issuers.
- The resource must be an origin-only HTTPS URL.
- Remote HTTP redirect URIs and URI fragments are rejected.
- No client secret is accepted or sent by this SDK.
- Tokens are stored as one value through `flutter_secure_storage`.
- Refresh failure `invalid_grant` clears the local token chain.
- Logout attempts refresh-token and access-token revocation before clearing the
  local session and requesting RP-initiated logout.
- Tokens and provider error descriptions are never included in SDK exceptions.
