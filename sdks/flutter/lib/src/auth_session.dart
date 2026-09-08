final class AuthSession {
  AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.idToken,
    required this.accessTokenExpiresAt,
    required List<String> scopes,
  }) : scopes = List.unmodifiable(scopes);

  final String accessToken;
  final String? refreshToken;
  final String idToken;
  final DateTime accessTokenExpiresAt;
  final List<String> scopes;

  bool canUseAccessTokenAt(DateTime now, Duration refreshSkew) =>
      accessTokenExpiresAt.isAfter(now.add(refreshSkew));

  Map<String, Object?> toJson() => {
        'access_token': accessToken,
        'refresh_token': refreshToken,
        'id_token': idToken,
        'access_token_expires_at':
            accessTokenExpiresAt.toUtc().toIso8601String(),
        'scopes': scopes,
      };

  factory AuthSession.fromJson(Map<String, Object?> json) => AuthSession(
        accessToken: json['access_token']! as String,
        refreshToken: json['refresh_token'] as String?,
        idToken: json['id_token']! as String,
        accessTokenExpiresAt: DateTime.parse(
          json['access_token_expires_at']! as String,
        ).toUtc(),
        scopes: (json['scopes']! as List<Object?>).cast<String>(),
      );

  @override
  bool operator ==(Object other) =>
      other is AuthSession &&
      accessToken == other.accessToken &&
      refreshToken == other.refreshToken &&
      idToken == other.idToken &&
      accessTokenExpiresAt == other.accessTokenExpiresAt &&
      _sameScopes(scopes, other.scopes);

  @override
  int get hashCode => Object.hash(
        accessToken,
        refreshToken,
        idToken,
        accessTokenExpiresAt,
        Object.hashAll(scopes),
      );

  static bool _sameScopes(List<String> left, List<String> right) {
    if (left.length != right.length) return false;
    for (var index = 0; index < left.length; index += 1) {
      if (left[index] != right[index]) return false;
    }
    return true;
  }
}

final class AuthTokenResponse {
  AuthTokenResponse({
    this.accessToken,
    this.refreshToken,
    this.idToken,
    this.accessTokenExpiresAt,
    List<String>? scopes,
  }) : scopes = scopes == null ? null : List.unmodifiable(scopes);

  final String? accessToken;
  final String? refreshToken;
  final String? idToken;
  final DateTime? accessTokenExpiresAt;
  final List<String>? scopes;
}
