import { describe, expect, it } from 'vitest';
import { resolveInitialPage } from '../src/App';

describe('resolveInitialPage', () => {
  it('prompt=create인 open 테넌트는 hosted signup으로 시작한다', () => {
    expect(
      resolveInitialPage({
        uid: 'uid-1',
        prompt: 'create',
        clientId: 'mobile-app',
        issuer: 'https://auth.example/t/acme/oidc',
        missingScopes: [],
        mfaRequired: false,
        signupAllowed: true,
        idpList: [],
      }),
    ).toBe('signup');
  });

  it('self signup이 닫힌 테넌트의 prompt=create 요청을 거부한다', () => {
    expect(
      resolveInitialPage({
        uid: 'uid-1',
        prompt: 'create',
        clientId: 'mobile-app',
        issuer: 'https://auth.example/t/acme/oidc',
        missingScopes: [],
        mfaRequired: false,
        signupAllowed: false,
        idpList: [],
      }),
    ).toBe('error');
  });
});
