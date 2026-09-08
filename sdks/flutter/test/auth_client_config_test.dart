import 'package:auth_platform_flutter/auth_platform_flutter.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AuthClientConfig', () {
    test('canonicalizes an HTTPS resource to its origin', () {
      final config = AuthClientConfig(
        issuer: Uri.parse('https://auth.example.com/t/acme/oidc/'),
        clientId: 'mobile-app',
        redirectUri: Uri.parse('com.example.app:/oauth/callback'),
        resource: Uri.parse('https://api.example.com/'),
      );

      expect(
        config.issuer,
        Uri.parse('https://auth.example.com/t/acme/oidc'),
      );
      expect(config.resource, Uri.parse('https://api.example.com'));
      expect(
        config.discoveryUrl,
        Uri.parse(
          'https://auth.example.com/t/acme/oidc/.well-known/openid-configuration',
        ),
      );
      expect(
        config.scopes,
        ['openid', 'profile', 'email', 'offline_access'],
      );
    });

    test('allows an HTTP issuer only for loopback development', () {
      expect(
        () => AuthClientConfig(
          issuer: Uri.parse('http://auth.example.com/t/acme/oidc'),
          clientId: 'mobile-app',
          redirectUri: Uri.parse('com.example.app:/oauth/callback'),
          resource: Uri.parse('https://api.example.com'),
        ),
        throwsArgumentError,
      );

      expect(
        AuthClientConfig(
          issuer: Uri.parse('http://localhost:3000/t/acme/oidc'),
          clientId: 'mobile-app',
          redirectUri: Uri.parse('com.example.app:/oauth/callback'),
          resource: Uri.parse('https://api.example.com'),
        ).allowInsecureConnections,
        isTrue,
      );
    });

    test('rejects a non-canonical or insecure API resource', () {
      for (final resource in [
        'http://api.example.com',
        'https://api.example.com/votes',
        'https://api.example.com?tenant=acme',
      ]) {
        expect(
          () => AuthClientConfig(
            issuer: Uri.parse('https://auth.example.com/t/acme/oidc'),
            clientId: 'mobile-app',
            redirectUri: Uri.parse('com.example.app:/oauth/callback'),
            resource: Uri.parse(resource),
          ),
          throwsArgumentError,
          reason: resource,
        );
      }
    });

    test('requires openid and rejects redirect URI fragments', () {
      expect(
        () => AuthClientConfig(
          issuer: Uri.parse('https://auth.example.com/t/acme/oidc'),
          clientId: 'mobile-app',
          redirectUri: Uri.parse('com.example.app:/oauth/callback#fragment'),
          resource: Uri.parse('https://api.example.com'),
        ),
        throwsArgumentError,
      );
      expect(
        () => AuthClientConfig(
          issuer: Uri.parse('https://auth.example.com/t/acme/oidc'),
          clientId: 'mobile-app',
          redirectUri: Uri.parse('com.example.app:/oauth/callback'),
          resource: Uri.parse('https://api.example.com'),
          scopes: const ['profile', 'email'],
        ),
        throwsArgumentError,
      );
    });

    test('rejects unsafe native redirect schemes and remote HTTP redirects',
        () {
      for (final redirectUri in [
        'javascript:alert(1)',
        'data:text/plain,callback',
        'file:///tmp/callback',
        'ftp://app.example.com/oauth/callback',
        'mailto:callback@example.com',
        'http://app.example.com/oauth/callback',
      ]) {
        expect(
          () => AuthClientConfig(
            issuer: Uri.parse('https://auth.example.com/t/acme/oidc'),
            clientId: 'mobile-app',
            redirectUri: Uri.parse(redirectUri),
            resource: Uri.parse('https://api.example.com'),
          ),
          throwsArgumentError,
          reason: redirectUri,
        );
      }
    });
  });
}
