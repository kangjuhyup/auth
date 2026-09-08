import 'package:flutter_appauth/flutter_appauth.dart';

import 'auth_client_config.dart';
import 'auth_contracts.dart';
import 'auth_protocol_exception.dart';
import 'auth_session.dart';

abstract interface class AppAuthDriver {
  Future<AuthorizationTokenResponse> authorizeAndExchangeCode(
    AuthorizationTokenRequest request,
  );

  Future<TokenResponse> token(TokenRequest request);

  Future<void> endSession(EndSessionRequest request);
}

final class FlutterAppAuthDriver implements AppAuthDriver {
  const FlutterAppAuthDriver({FlutterAppAuth appAuth = const FlutterAppAuth()})
      : _appAuth = appAuth;

  final FlutterAppAuth _appAuth;

  @override
  Future<AuthorizationTokenResponse> authorizeAndExchangeCode(
    AuthorizationTokenRequest request,
  ) =>
      _appAuth.authorizeAndExchangeCode(request);

  @override
  Future<TokenResponse> token(TokenRequest request) => _appAuth.token(request);

  @override
  Future<void> endSession(EndSessionRequest request) async {
    await _appAuth.endSession(request);
  }
}

final class AppAuthAuthorizationGateway implements AuthorizationGateway {
  AppAuthAuthorizationGateway({AppAuthDriver? driver})
      : _driver = driver ?? const FlutterAppAuthDriver();

  final AppAuthDriver _driver;

  @override
  Future<AuthTokenResponse> authorize(
    AuthClientConfig config, {
    AuthorizationIntent intent = AuthorizationIntent.signIn,
  }) async {
    try {
      final response = await _driver.authorizeAndExchangeCode(
        AuthorizationTokenRequest(
          config.clientId,
          config.redirectUri.toString(),
          discoveryUrl: config.discoveryUrl.toString(),
          scopes: config.scopes,
          promptValues:
              intent == AuthorizationIntent.signUp ? const ['create'] : null,
          additionalParameters: {'resource': config.resource.toString()},
          allowInsecureConnections: config.allowInsecureConnections,
        ),
      );
      return _toResponse(response);
    } on FlutterAppAuthUserCancelledException {
      throw const AuthProtocolException('user_cancelled');
    } on FlutterAppAuthPlatformException catch (error) {
      throw AuthProtocolException(
        error.platformErrorDetails.error ?? 'authorization_failed',
      );
    }
  }

  @override
  Future<AuthTokenResponse> refresh(
    AuthClientConfig config,
    String refreshToken,
  ) async {
    try {
      final response = await _driver.token(
        TokenRequest(
          config.clientId,
          config.redirectUri.toString(),
          discoveryUrl: config.discoveryUrl.toString(),
          refreshToken: refreshToken,
          scopes: config.scopes,
          additionalParameters: {'resource': config.resource.toString()},
          allowInsecureConnections: config.allowInsecureConnections,
        ),
      );
      return _toResponse(response);
    } on FlutterAppAuthPlatformException catch (error) {
      throw AuthProtocolException(
        error.platformErrorDetails.error ?? 'token_request_failed',
      );
    }
  }

  @override
  Future<void> endSession(
    AuthClientConfig config,
    String idToken,
  ) async {
    final postLogoutRedirectUri = config.postLogoutRedirectUri;
    if (postLogoutRedirectUri == null) {
      throw const AuthProtocolException(
        'post_logout_redirect_uri_required',
      );
    }
    try {
      await _driver.endSession(
        EndSessionRequest(
          idTokenHint: idToken,
          postLogoutRedirectUrl: postLogoutRedirectUri.toString(),
          discoveryUrl: config.discoveryUrl.toString(),
          allowInsecureConnections: config.allowInsecureConnections,
        ),
      );
    } on FlutterAppAuthUserCancelledException {
      throw const AuthProtocolException('user_cancelled');
    } on FlutterAppAuthPlatformException catch (error) {
      throw AuthProtocolException(
        error.platformErrorDetails.error ?? 'end_session_failed',
      );
    }
  }

  static AuthTokenResponse _toResponse(TokenResponse response) =>
      AuthTokenResponse(
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        idToken: response.idToken,
        accessTokenExpiresAt: response.accessTokenExpirationDateTime,
        scopes: response.scopes,
      );
}
