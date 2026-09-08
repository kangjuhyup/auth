import 'package:auth_platform_flutter/auth_platform_flutter.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('round-trips the complete session through one secure value', () async {
    final backend = MemorySecretStorage();
    final store = SecureAuthSessionStore(
      storageKey: 'auth-platform:test',
      backend: backend,
    );
    final session = AuthSession(
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      idToken: 'id-1',
      accessTokenExpiresAt: DateTime.utc(2026, 9, 8, 5),
      scopes: const ['openid', 'offline_access'],
    );

    await store.write(session);

    expect(await store.read(), session);
    await store.clear();
    expect(await store.read(), isNull);
  });

  test('clears malformed storage without exposing its contents', () async {
    final backend = MemorySecretStorage()
      ..values['auth-platform:test'] = '{"access_token":"sensitive-token"';
    final store = SecureAuthSessionStore(
      storageKey: 'auth-platform:test',
      backend: backend,
    );

    await expectLater(
      store.read(),
      throwsA(
        isA<AuthProtocolException>()
            .having(
              (error) => error.code,
              'code',
              'invalid_stored_session',
            )
            .having(
              (error) => error.toString(),
              'safe string',
              isNot(contains('sensitive-token')),
            ),
      ),
    );
    expect(backend.values, isEmpty);
  });
}

class MemorySecretStorage implements SecretStorageBackend {
  final values = <String, String>{};

  @override
  Future<void> delete(String key) async => values.remove(key);

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> write(String key, String value) async => values[key] = value;
}
