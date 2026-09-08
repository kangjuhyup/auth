import 'package:auth_platform_flutter/auth_platform_flutter.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  final config = AuthClientConfig(
    issuer: Uri.parse('https://auth.example.com/t/acme/oidc'),
    clientId: 'mobile-app',
    redirectUri: Uri.parse('com.example.app:/oauth/callback'),
    resource: Uri.parse('https://api.example.com'),
  );

  test('discovers and calls the same-origin revocation endpoint', () async {
    late http.Request revocationRequest;
    final client = MockClient((request) async {
      if (request.method == 'GET') {
        return http.Response(
          '{"issuer":"https://auth.example.com/t/acme/oidc",'
          '"revocation_endpoint":"https://auth.example.com/t/acme/oidc/token/revocation"}',
          200,
          headers: {'content-type': 'application/json'},
        );
      }
      revocationRequest = request;
      return http.Response('', 200);
    });
    final revoker = HttpTokenRevoker(client: client);

    await revoker.revoke(
      config,
      'refresh-1',
      TokenTypeHint.refreshToken,
    );

    expect(revocationRequest.followRedirects, isFalse);
    expect(revocationRequest.bodyFields, {
      'client_id': 'mobile-app',
      'token': 'refresh-1',
      'token_type_hint': 'refresh_token',
    });
  });

  test('rejects a cross-origin revocation endpoint before sending a token',
      () async {
    var postCalls = 0;
    final client = MockClient((request) async {
      if (request.method == 'POST') postCalls += 1;
      return http.Response(
        '{"issuer":"https://auth.example.com/t/acme/oidc",'
        '"revocation_endpoint":"https://evil.example/revoke"}',
        200,
        headers: {'content-type': 'application/json'},
      );
    });

    await expectLater(
      HttpTokenRevoker(client: client).revoke(
        config,
        'refresh-1',
        TokenTypeHint.refreshToken,
      ),
      throwsA(isA<AuthProtocolException>()),
    );
    expect(postCalls, 0);
  });

  test('rejects discovery metadata for a different tenant issuer', () async {
    var postCalls = 0;
    final client = MockClient((request) async {
      if (request.method == 'POST') postCalls += 1;
      return http.Response(
        '{"issuer":"https://auth.example.com/t/other/oidc",'
        '"revocation_endpoint":"https://auth.example.com/t/acme/oidc/token/revocation"}',
        200,
        headers: {'content-type': 'application/json'},
      );
    });

    await expectLater(
      HttpTokenRevoker(client: client).revoke(
        config,
        'refresh-1',
        TokenTypeHint.refreshToken,
      ),
      throwsA(
        isA<AuthProtocolException>().having(
          (error) => error.code,
          'code',
          'issuer_mismatch',
        ),
      ),
    );
    expect(postCalls, 0);
  });
}
