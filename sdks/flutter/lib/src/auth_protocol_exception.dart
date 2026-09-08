final class AuthProtocolException implements Exception {
  const AuthProtocolException(this.code);

  final String code;

  @override
  String toString() => 'AuthProtocolException($code)';
}
