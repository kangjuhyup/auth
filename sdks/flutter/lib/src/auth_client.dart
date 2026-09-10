import 'dart:async';

import 'auth_client_config.dart';
import 'auth_contracts.dart';
import 'auth_protocol_exception.dart';
import 'auth_session.dart';

typedef AuthClock = DateTime Function();

final class AuthClient {
  AuthClient({
    required this.config,
    required AuthorizationGateway authorizationGateway,
    required AuthSessionStore sessionStore,
    required TokenRevoker tokenRevoker,
    AuthClock? now,
    this.refreshSkew = const Duration(seconds: 30),
  })  : _authorizationGateway = authorizationGateway,
        _sessionStore = sessionStore,
        _tokenRevoker = tokenRevoker,
        _now = now ?? DateTime.now;

  final AuthClientConfig config;
  final AuthorizationGateway _authorizationGateway;
  final AuthSessionStore _sessionStore;
  final TokenRevoker _tokenRevoker;
  final AuthClock _now;
  final Duration refreshSkew;
  Future<String?>? _refreshInFlight;

  Future<AuthSession> signIn() => _authorize();

  Future<AuthSession> _authorize() async {
    final response = await _authorizationGateway.authorize(config);
    final session = _mergeResponse(response, previous: null);
    await _sessionStore.write(session);
    return session;
  }

  Future<AuthSession?> session() => _sessionStore.read();

  Future<String?> accessToken() async {
    final current = await _sessionStore.read();
    if (current == null) return null;
    if (current.canUseAccessTokenAt(_now(), refreshSkew)) {
      return current.accessToken;
    }
    if (current.refreshToken == null) {
      await _sessionStore.clear();
      return null;
    }

    final activeRefresh = _refreshInFlight;
    if (activeRefresh != null) return activeRefresh;

    final operation = _refresh(current);
    _refreshInFlight = operation;
    try {
      return await operation;
    } finally {
      if (identical(_refreshInFlight, operation)) _refreshInFlight = null;
    }
  }

  Future<void> signOut() async {
    final current = await _sessionStore.read();
    Object? firstError;
    StackTrace? firstStackTrace;

    Future<void> attempt(Future<void> Function() action) async {
      try {
        await action();
      } catch (error, stackTrace) {
        firstError ??= error;
        firstStackTrace ??= stackTrace;
      }
    }

    if (current case final session?) {
      if (session.refreshToken case final refreshToken?) {
        await attempt(
          () => _tokenRevoker.revoke(
            config,
            refreshToken,
            TokenTypeHint.refreshToken,
          ),
        );
      }
      await attempt(
        () => _tokenRevoker.revoke(
          config,
          session.accessToken,
          TokenTypeHint.accessToken,
        ),
      );
      if (config.postLogoutRedirectUri != null) {
        await attempt(
          () => _authorizationGateway.endSession(config, session.idToken),
        );
      }
    }

    await _sessionStore.clear();
    if (firstError case final error?) {
      Error.throwWithStackTrace(error, firstStackTrace!);
    }
  }

  Future<String?> _refresh(AuthSession previous) async {
    try {
      final response = await _authorizationGateway.refresh(
        config,
        previous.refreshToken!,
      );
      final next = _mergeResponse(response, previous: previous);
      await _sessionStore.write(next);
      return next.accessToken;
    } on AuthProtocolException catch (error) {
      if (error.code == 'invalid_grant') await _sessionStore.clear();
      rethrow;
    }
  }

  AuthSession _mergeResponse(
    AuthTokenResponse response, {
    required AuthSession? previous,
  }) {
    final accessToken = response.accessToken;
    final idToken = response.idToken ?? previous?.idToken;
    final expiresAt = response.accessTokenExpiresAt;
    if (accessToken == null || idToken == null || expiresAt == null) {
      throw const AuthProtocolException('invalid_token_response');
    }
    return AuthSession(
      accessToken: accessToken,
      refreshToken: response.refreshToken ?? previous?.refreshToken,
      idToken: idToken,
      accessTokenExpiresAt: expiresAt,
      scopes: response.scopes ?? previous?.scopes ?? config.scopes,
    );
  }
}
