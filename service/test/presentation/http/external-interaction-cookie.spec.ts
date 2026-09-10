import {
  externalInteractionBrowserCookieName,
  readExternalInteractionBrowserBinding,
  setExternalInteractionCookies,
} from '@presentation/http/external-interaction-cookie';

describe('external interaction cookies', () => {
  it('provider interaction cookie를 exact interaction path의 cross-site cookie로 재발급한다', () => {
    const response = { cookie: jest.fn() };
    const request = {
      headers: {
        cookie:
          '_interaction_acme=uid_12345678; _interaction_acme.sig=signed-cookie',
      },
    };

    setExternalInteractionCookies({
      request: request as any,
      response: response as any,
      tenantCode: 'acme',
      uid: 'uid_12345678',
      browserBinding: 'browser-binding',
      maxAgeMs: 300_000,
      secure: true,
    });

    expect(response.cookie).toHaveBeenCalledTimes(3);
    expect(response.cookie).toHaveBeenCalledWith(
      '_interaction_acme',
      'uid_12345678',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/t/acme/interaction/uid_12345678',
        maxAge: 300_000,
      }),
    );
    expect(response.cookie).toHaveBeenCalledWith(
      '_external_interaction_acme',
      'browser-binding',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('명시적 localhost 개발 흐름은 Secure 없이 SameSite=Lax를 사용한다', () => {
    const response = { cookie: jest.fn() };
    setExternalInteractionCookies({
      request: {
        headers: {
          cookie:
            '_interaction_acme=uid_12345678; _interaction_acme.sig=signed-cookie',
        },
      } as any,
      response: response as any,
      tenantCode: 'acme',
      uid: 'uid_12345678',
      browserBinding: 'browser-binding',
      maxAgeMs: 300_000,
      secure: false,
    });

    expect(response.cookie).toHaveBeenCalledWith(
      '_interaction_acme',
      'uid_12345678',
      expect.objectContaining({ secure: false, sameSite: 'lax' }),
    );
  });

  it('uid와 일치하는 provider cookie 및 서명이 없으면 위임하지 않는다', () => {
    expect(() =>
      setExternalInteractionCookies({
        request: {
          headers: { cookie: '_interaction_acme=other_uid_12345' },
        } as any,
        response: { cookie: jest.fn() } as any,
        tenantCode: 'acme',
        uid: 'uid_12345678',
        browserBinding: 'browser-binding',
        maxAgeMs: 300_000,
        secure: true,
      }),
    ).toThrow('External interaction cookie binding is missing');
  });

  it('HttpOnly browser binding cookie를 요청에서 읽는다', () => {
    expect(externalInteractionBrowserCookieName('acme')).toBe(
      '_external_interaction_acme',
    );
    expect(
      readExternalInteractionBrowserBinding(
        {
          headers: { cookie: '_external_interaction_acme=binding-1' },
        } as any,
        'acme',
      ),
    ).toBe('binding-1');
  });
});
