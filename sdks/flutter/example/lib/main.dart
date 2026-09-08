import 'package:auth_platform_flutter/auth_platform_flutter.dart';
import 'package:flutter/material.dart';

void main() => runApp(const AuthExampleApp());

class AuthExampleApp extends StatefulWidget {
  const AuthExampleApp({super.key});

  @override
  State<AuthExampleApp> createState() => _AuthExampleAppState();
}

class _AuthExampleAppState extends State<AuthExampleApp> {
  late final AuthClientConfig _config = AuthClientConfig(
    issuer: Uri.parse('https://auth.example.com/t/acme/oidc'),
    clientId: 'mobile-app',
    redirectUri: Uri.parse('com.example.app:/oauth/callback'),
    postLogoutRedirectUri: Uri.parse('com.example.app:/logout/callback'),
    resource: Uri.parse('https://api.example.com'),
  );

  late final AuthClient _auth = AuthClient(
    config: _config,
    authorizationGateway: AppAuthAuthorizationGateway(),
    sessionStore: SecureAuthSessionStore(storageKey: _config.storageKey),
    tokenRevoker: HttpTokenRevoker(),
  );

  bool _signedIn = false;

  @override
  Widget build(BuildContext context) => MaterialApp(
        home: Scaffold(
          appBar: AppBar(title: const Text('Auth Platform')),
          body: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                FilledButton(
                  onPressed: _signedIn ? _signOut : _signIn,
                  child: Text(_signedIn ? 'Sign out' : 'Sign in'),
                ),
                if (!_signedIn) ...[
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: _signUp,
                    child: const Text('Create account'),
                  ),
                ],
              ],
            ),
          ),
        ),
      );

  Future<void> _signIn() async {
    await _auth.signIn();
    if (mounted) setState(() => _signedIn = true);
  }

  Future<void> _signUp() async {
    await _auth.signUp();
    if (mounted) setState(() => _signedIn = true);
  }

  Future<void> _signOut() async {
    await _auth.signOut();
    if (mounted) setState(() => _signedIn = false);
  }
}
