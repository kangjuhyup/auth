import { describe, expect, it } from 'vitest';
import { resolveInitialPage } from '../src/App';

describe('resolveInitialPage', () => {
  it('login prompt는 로그인 화면으로 시작한다', () => {
    expect(
      resolveInitialPage({
        uid: 'uid-1',
        prompt: 'login',
        clientId: 'mobile-app',
        missingScopes: [],
        mfaRequired: false,
        idpList: [],
      }),
    ).toBe('login');
  });

  it('지원하지 않는 create prompt는 오류 화면으로 보낸다', () => {
    expect(
      resolveInitialPage({
        uid: 'uid-1',
        prompt: 'create',
        clientId: 'mobile-app',
        missingScopes: [],
        mfaRequired: false,
        idpList: [],
      }),
    ).toBe('error');
  });
});
