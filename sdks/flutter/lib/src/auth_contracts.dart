import 'auth_client_config.dart';
import 'auth_session.dart';

enum AuthorizationIntent { signIn, signUp }

abstract interface class AuthorizationGateway {
  Future<AuthTokenResponse> authorize(
    AuthClientConfig config, {
    AuthorizationIntent intent = AuthorizationIntent.signIn,
  });

  Future<AuthTokenResponse> refresh(
    AuthClientConfig config,
    String refreshToken,
  );

  Future<void> endSession(AuthClientConfig config, String idToken);
}

abstract interface class AuthSessionStore {
  Future<AuthSession?> read();

  Future<void> write(AuthSession value);

  Future<void> clear();
}

enum TokenTypeHint {
  accessToken('access_token'),
  refreshToken('refresh_token');

  const TokenTypeHint(this.value);

  final String value;
}

abstract interface class TokenRevoker {
  Future<void> revoke(
    AuthClientConfig config,
    String token,
    TokenTypeHint hint,
  );
}
