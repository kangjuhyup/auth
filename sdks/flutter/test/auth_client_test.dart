import 'dart:async';

import 'package:auth_platform_flutter/auth_platform_flutter.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late AuthClientConfig config;
  late MemorySessionStore store;
  late FakeAuthorizationGateway gateway;
  late FakeTokenRevoker revoker;
  final now = DateTime.utc(2026, 9, 8, 4);

  setUp(() {
    config = AuthClientConfig(
      issuer: Uri.parse('https://auth.example.com/t/acme/oidc'),
      clientId: 'mobile-app',
      redirectUri: Uri.parse('com.example.app:/oauth/callback'),
      postLogoutRedirectUri: Uri.parse('com.example.app:/logout/callback'),
      resource: Uri.parse('https://api.example.com'),
    );
    store = MemorySessionStore();
    gateway = FakeAuthorizationGateway();
    revoker = FakeTokenRevoker();
  });

  test('signIn persists the AppAuth token response', () async {
    gateway.authorizeResponse = AuthTokenResponse(
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      idToken: 'id-1',
      accessTokenExpiresAt: now.add(const Duration(minutes: 5)),
      scopes: config.scopes,
    );
    final client = createClient(config, gateway, store, revoker, now);

    final session = await client.signIn();

    expect(session.accessToken, 'access-1');
    expect((await store.read())?.refreshToken, 'refresh-1');
  });

  test('concurrent accessToken calls share one rotating refresh request',
      () async {
    store.session = AuthSession(
      accessToken: 'access-old',
      refreshToken: 'refresh-old',
      idToken: 'id-old',
      accessTokenExpiresAt: now.subtract(const Duration(seconds: 1)),
      scopes: config.scopes,
    );
    final refreshStarted = Completer<void>();
    final releaseRefresh = Completer<AuthTokenResponse>();
    gateway.onRefresh = () {
      refreshStarted.complete();
      return releaseRefresh.future;
    };
    final client = createClient(config, gateway, store, revoker, now);

    final first = client.accessToken();
    final second = client.accessToken();
    await refreshStarted.future;
    releaseRefresh.complete(
      AuthTokenResponse(
        accessToken: 'access-new',
        refreshToken: 'refresh-new',
        accessTokenExpiresAt: now.add(const Duration(minutes: 5)),
      ),
    );

    expect(await Future.wait([first, second]), ['access-new', 'access-new']);
    expect(gateway.refreshCalls, 1);
    expect((await store.read())?.idToken, 'id-old');
    expect((await store.read())?.refreshToken, 'refresh-new');
  });

  test('invalid_grant clears the local token chain', () async {
    store.session = AuthSession(
      accessToken: 'access-old',
      refreshToken: 'refresh-old',
      idToken: 'id-old',
      accessTokenExpiresAt: now.subtract(const Duration(seconds: 1)),
      scopes: config.scopes,
    );
    gateway.onRefresh = () async {
      throw const AuthProtocolException('invalid_grant');
    };
    final client = createClient(config, gateway, store, revoker, now);

    await expectLater(
        client.accessToken(), throwsA(isA<AuthProtocolException>()));

    expect(await store.read(), isNull);
  });

  test('signOut revokes refresh and access tokens before local cleanup',
      () async {
    store.session = AuthSession(
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      idToken: 'id-1',
      accessTokenExpiresAt: now.add(const Duration(minutes: 5)),
      scopes: config.scopes,
    );
    final client = createClient(config, gateway, store, revoker, now);

    await client.signOut();

    expect(revoker.calls, [
      ('refresh-1', TokenTypeHint.refreshToken),
      ('access-1', TokenTypeHint.accessToken),
    ]);
    expect(gateway.endedIdToken, 'id-1');
    expect(await store.read(), isNull);
  });
}

AuthClient createClient(
  AuthClientConfig config,
  FakeAuthorizationGateway gateway,
  MemorySessionStore store,
  FakeTokenRevoker revoker,
  DateTime now,
) =>
    AuthClient(
      config: config,
      authorizationGateway: gateway,
      sessionStore: store,
      tokenRevoker: revoker,
      now: () => now,
    );

class MemorySessionStore implements AuthSessionStore {
  AuthSession? session;

  @override
  Future<void> clear() async => session = null;

  @override
  Future<AuthSession?> read() async => session;

  @override
  Future<void> write(AuthSession value) async => session = value;
}

class FakeAuthorizationGateway implements AuthorizationGateway {
  late AuthTokenResponse authorizeResponse;
  Future<AuthTokenResponse> Function()? onRefresh;
  int refreshCalls = 0;
  String? endedIdToken;

  @override
  Future<AuthTokenResponse> authorize(AuthClientConfig config) async =>
      authorizeResponse;

  @override
  Future<void> endSession(
    AuthClientConfig config,
    String idToken,
  ) async {
    endedIdToken = idToken;
  }

  @override
  Future<AuthTokenResponse> refresh(
    AuthClientConfig config,
    String refreshToken,
  ) {
    refreshCalls += 1;
    return onRefresh!.call();
  }
}

class FakeTokenRevoker implements TokenRevoker {
  final calls = <(String, TokenTypeHint)>[];

  @override
  Future<void> revoke(
    AuthClientConfig config,
    String token,
    TokenTypeHint hint,
  ) async {
    calls.add((token, hint));
  }
}
