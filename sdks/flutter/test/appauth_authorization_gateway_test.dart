import 'package:auth_platform_flutter/auth_platform_flutter.dart';
import 'package:flutter_appauth/flutter_appauth.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late AuthClientConfig config;
  late FakeAppAuthDriver driver;
  late AppAuthAuthorizationGateway gateway;

  setUp(() {
    config = AuthClientConfig(
      issuer: Uri.parse('https://auth.example.com/t/acme/oidc'),
      clientId: 'mobile-app',
      redirectUri: Uri.parse('com.example.app:/oauth/callback'),
      postLogoutRedirectUri: Uri.parse('com.example.app:/logout/callback'),
      resource: Uri.parse('https://api.example.com'),
    );
    driver = FakeAppAuthDriver();
    gateway = AppAuthAuthorizationGateway(driver: driver);
  });

  test('delegates authorization code and PKCE handling to AppAuth', () async {
    driver.authorizationResponse = AuthorizationTokenResponse(
      'access-1',
      'refresh-1',
      DateTime.utc(2026, 9, 8, 5),
      'id-1',
      'Bearer',
      config.scopes,
      null,
      null,
    );

    final response = await gateway.authorize(config);

    final request = driver.authorizationRequest!;
    expect(request.clientSecret, isNull);
    expect(request.discoveryUrl, config.discoveryUrl.toString());
    expect(request.additionalParameters, {
      'resource': 'https://api.example.com',
    });
    expect(request.promptValues, isNull);
    expect(response.idToken, 'id-1');
  });

  test('keeps the granted resource on refresh without a client secret',
      () async {
    driver.tokenResponse = TokenResponse(
      'access-2',
      'refresh-2',
      DateTime.utc(2026, 9, 8, 6),
      null,
      'Bearer',
      config.scopes,
      null,
    );

    await gateway.refresh(config, 'refresh-1');

    final request = driver.tokenRequest!;
    expect(request.clientSecret, isNull);
    expect(request.refreshToken, 'refresh-1');
    expect(request.additionalParameters, {
      'resource': 'https://api.example.com',
    });
  });

  test('maps OAuth invalid_grant without exposing response details', () async {
    driver.tokenError = FlutterAppAuthPlatformException(
      code: 'token_failed',
      platformErrorDetails: FlutterAppAuthPlatformErrorDetails(
        error: 'invalid_grant',
        errorDescription: 'sensitive provider detail',
      ),
    );

    await expectLater(
      gateway.refresh(config, 'refresh-1'),
      throwsA(
        isA<AuthProtocolException>()
            .having((error) => error.code, 'code', 'invalid_grant')
            .having(
              (error) => error.toString(),
              'safe string',
              isNot(contains('sensitive provider detail')),
            ),
      ),
    );
  });

  test('rejects end session when no post-logout redirect is configured',
      () async {
    final configWithoutLogout = AuthClientConfig(
      issuer: Uri.parse('https://auth.example.com/t/acme/oidc'),
      clientId: 'mobile-app',
      redirectUri: Uri.parse('com.example.app:/oauth/callback'),
      resource: Uri.parse('https://api.example.com'),
    );

    await expectLater(
      gateway.endSession(configWithoutLogout, 'id-1'),
      throwsA(
        isA<AuthProtocolException>().having(
          (error) => error.code,
          'code',
          'post_logout_redirect_uri_required',
        ),
      ),
    );
    expect(driver.endSessionRequest, isNull);
  });
}

class FakeAppAuthDriver implements AppAuthDriver {
  AuthorizationTokenResponse? authorizationResponse;
  TokenResponse? tokenResponse;
  Object? tokenError;
  AuthorizationTokenRequest? authorizationRequest;
  TokenRequest? tokenRequest;
  EndSessionRequest? endSessionRequest;

  @override
  Future<AuthorizationTokenResponse> authorizeAndExchangeCode(
    AuthorizationTokenRequest request,
  ) async {
    authorizationRequest = request;
    return authorizationResponse!;
  }

  @override
  Future<void> endSession(EndSessionRequest request) async {
    endSessionRequest = request;
  }

  @override
  Future<TokenResponse> token(TokenRequest request) async {
    tokenRequest = request;
    if (tokenError case final error?) throw error;
    return tokenResponse!;
  }
}
