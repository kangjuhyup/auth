final class AuthClientConfig {
  factory AuthClientConfig({
    required Uri issuer,
    required String clientId,
    required Uri redirectUri,
    required Uri resource,
    Uri? postLogoutRedirectUri,
    List<String> scopes = const [
      'openid',
      'profile',
      'email',
      'offline_access',
    ],
  }) {
    _validateIssuer(issuer);
    _validateClientId(clientId);
    _validateRedirectUri(redirectUri, 'redirectUri');
    if (postLogoutRedirectUri case final uri?) {
      _validateRedirectUri(uri, 'postLogoutRedirectUri');
    }
    _validateResource(resource);
    final normalizedScopes = _normalizeScopes(scopes);

    return AuthClientConfig._(
      issuer: _withoutTrailingSlash(issuer),
      clientId: clientId,
      redirectUri: redirectUri,
      postLogoutRedirectUri: postLogoutRedirectUri,
      resource: Uri(
        scheme: resource.scheme.toLowerCase(),
        host: resource.host.toLowerCase(),
        port: resource.hasPort ? resource.port : null,
      ),
      scopes: normalizedScopes,
    );
  }

  const AuthClientConfig._({
    required this.issuer,
    required this.clientId,
    required this.redirectUri,
    required this.postLogoutRedirectUri,
    required this.resource,
    required this.scopes,
  });

  final Uri issuer;
  final String clientId;
  final Uri redirectUri;
  final Uri? postLogoutRedirectUri;
  final Uri resource;
  final List<String> scopes;

  bool get allowInsecureConnections => issuer.scheme == 'http';

  Uri get discoveryUrl => Uri.parse('$issuer/.well-known/openid-configuration');

  String get storageKey =>
      'auth_platform_flutter:${Uri.encodeComponent('$issuer|$clientId')}';

  static void _validateIssuer(Uri value) {
    if (!value.isAbsolute ||
        value.host.isEmpty ||
        value.userInfo.isNotEmpty ||
        value.hasQuery ||
        value.hasFragment) {
      throw ArgumentError.value(value, 'issuer', 'must be an absolute issuer');
    }
    if (value.scheme == 'https') return;
    if (value.scheme == 'http' && _isLoopback(value.host)) return;
    throw ArgumentError.value(
      value,
      'issuer',
      'must use HTTPS except for loopback development',
    );
  }

  static void _validateClientId(String value) {
    if (value.isEmpty || value.trim() != value) {
      throw ArgumentError.value(
          value, 'clientId', 'must not be empty or padded');
    }
  }

  static void _validateRedirectUri(Uri value, String name) {
    if (!value.isAbsolute || value.hasFragment || value.userInfo.isNotEmpty) {
      throw ArgumentError.value(
        value,
        name,
        'must be absolute and must not contain a fragment or user info',
      );
    }

    final scheme = value.scheme.toLowerCase();
    if (scheme == 'https' && value.host.isNotEmpty) return;
    if (scheme == 'http' && _isLoopback(value.host)) return;
    if (scheme.contains('.')) return;

    throw ArgumentError.value(
      value,
      name,
      'must use HTTPS, loopback HTTP, or a reverse-domain custom scheme',
    );
  }

  static void _validateResource(Uri value) {
    if (!value.isAbsolute ||
        value.scheme != 'https' ||
        value.host.isEmpty ||
        value.userInfo.isNotEmpty ||
        (value.path.isNotEmpty && value.path != '/') ||
        value.hasQuery ||
        value.hasFragment) {
      throw ArgumentError.value(
        value,
        'resource',
        'must be a canonical HTTPS origin',
      );
    }
  }

  static List<String> _normalizeScopes(List<String> values) {
    final scopes = <String>{};
    for (final scope in values) {
      if (scope.isEmpty || scope.contains(RegExp(r'\s'))) {
        throw ArgumentError.value(
            values, 'scopes', 'contains an invalid scope');
      }
      scopes.add(scope);
    }
    if (!scopes.contains('openid')) {
      throw ArgumentError.value(values, 'scopes', 'openid is required');
    }
    return List.unmodifiable(scopes);
  }

  static Uri _withoutTrailingSlash(Uri value) {
    final normalizedPath =
        value.path == '/' ? '' : value.path.replaceFirst(RegExp(r'/+$'), '');
    return value.replace(path: normalizedPath);
  }

  static bool _isLoopback(String host) {
    final normalized = host.toLowerCase();
    return normalized == 'localhost' ||
        normalized == '127.0.0.1' ||
        normalized == '::1';
  }
}
