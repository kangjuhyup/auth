import { extractOidcSessionDescriptor } from '@infrastructure/oidc-provider/session/oidc-session-payload';

describe('extractOidcSessionDescriptor', () => {
  it('Session authorizations에서 clientId와 grantId를 추출한다', () => {
    const result = extractOidcSessionDescriptor({
      accountId: 'user-1',
      authorizations: {
        'web-app': { grantId: 'grant-1' },
      },
    } as any);

    expect(result).toEqual({
      accountId: 'user-1',
      authorizations: [{ clientId: 'web-app', grantId: 'grant-1' }],
    });
  });

  it('accountId 또는 client authorization이 없으면 null을 반환한다', () => {
    expect(
      extractOidcSessionDescriptor({ authorizations: {} } as any),
    ).toBeNull();
    expect(
      extractOidcSessionDescriptor({ accountId: 'user-1' } as any),
    ).toBeNull();
  });
});
