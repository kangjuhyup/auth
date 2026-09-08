import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'auth_contracts.dart';
import 'auth_protocol_exception.dart';
import 'auth_session.dart';

abstract interface class SecretStorageBackend {
  Future<String?> read(String key);

  Future<void> write(String key, String value);

  Future<void> delete(String key);
}

final class FlutterSecureStorageBackend implements SecretStorageBackend {
  FlutterSecureStorageBackend({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}

final class SecureAuthSessionStore implements AuthSessionStore {
  SecureAuthSessionStore({
    required this.storageKey,
    SecretStorageBackend? backend,
  }) : _backend = backend ?? FlutterSecureStorageBackend();

  final String storageKey;
  final SecretStorageBackend _backend;

  @override
  Future<AuthSession?> read() async {
    final encoded = await _backend.read(storageKey);
    if (encoded == null) return null;
    try {
      return AuthSession.fromJson(
        (jsonDecode(encoded) as Map<Object?, Object?>).cast<String, Object?>(),
      );
    } catch (_) {
      await _backend.delete(storageKey);
      throw const AuthProtocolException('invalid_stored_session');
    }
  }

  @override
  Future<void> write(AuthSession value) =>
      _backend.write(storageKey, jsonEncode(value.toJson()));

  @override
  Future<void> clear() => _backend.delete(storageKey);
}
