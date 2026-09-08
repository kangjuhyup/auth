import 'dart:convert';

import 'package:http/http.dart' as http;

import 'auth_client_config.dart';
import 'auth_contracts.dart';
import 'auth_protocol_exception.dart';

final class HttpTokenRevoker implements TokenRevoker {
  HttpTokenRevoker({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  @override
  Future<void> revoke(
    AuthClientConfig config,
    String token,
    TokenTypeHint hint,
  ) async {
    final discovery = await _client.get(config.discoveryUrl);
    if (discovery.statusCode != 200) {
      throw const AuthProtocolException('discovery_failed');
    }

    final metadata = (jsonDecode(discovery.body) as Map<Object?, Object?>)
        .cast<String, Object?>();
    final metadataIssuer = metadata['issuer'];
    if (metadataIssuer is! String ||
        Uri.parse(metadataIssuer) != config.issuer) {
      throw const AuthProtocolException('issuer_mismatch');
    }
    final endpointValue = metadata['revocation_endpoint'];
    if (endpointValue is! String) {
      throw const AuthProtocolException('revocation_not_supported');
    }
    final endpoint = Uri.parse(endpointValue);
    if (!_sameOrigin(config.issuer, endpoint)) {
      throw const AuthProtocolException('invalid_revocation_endpoint');
    }

    final request = http.Request('POST', endpoint)
      ..followRedirects = false
      ..bodyFields = {
        'client_id': config.clientId,
        'token': token,
        'token_type_hint': hint.value,
      };
    final response = await _client.send(request);
    await response.stream.drain<void>();
    if (response.statusCode != 200) {
      throw const AuthProtocolException('revocation_failed');
    }
  }

  static bool _sameOrigin(Uri issuer, Uri endpoint) =>
      endpoint.isAbsolute &&
      endpoint.userInfo.isEmpty &&
      !endpoint.hasFragment &&
      issuer.scheme == endpoint.scheme &&
      issuer.host.toLowerCase() == endpoint.host.toLowerCase() &&
      _effectivePort(issuer) == _effectivePort(endpoint);

  static int _effectivePort(Uri uri) {
    if (uri.hasPort) return uri.port;
    return uri.scheme == 'https' ? 443 : 80;
  }
}
