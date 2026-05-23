import {
  ADMIN_SESSION_COOKIE_NAME,
  buildAdminSessionCookieOptions,
  resolveAdminSessionToken,
} from '@presentation/http/admin-session-cookie';

function makeConfig(values: Record<string, string | undefined>) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as any;
}

describe('admin-session-cookie', () => {
  it('production 기본값은 HttpOnly Secure SameSite=Lax 쿠키 옵션을 사용한다', () => {
    const options = buildAdminSessionCookieOptions(
      makeConfig({ NODE_ENV: 'production' }),
    );

    expect(options).toEqual(
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      }),
    );
  });

  it('SameSite=None이면 secure 설정을 강제한다', () => {
    const options = buildAdminSessionCookieOptions(
      makeConfig({
        NODE_ENV: 'development',
        ADMIN_SESSION_COOKIE_SECURE: 'false',
        ADMIN_SESSION_COOKIE_SAME_SITE: 'none',
      }),
    );

    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe('none');
  });

  it('cookie token을 Authorization bearer보다 우선한다', () => {
    const token = resolveAdminSessionToken({
      headers: {
        cookie: `${ADMIN_SESSION_COOKIE_NAME}=cookie-token`,
        authorization: 'Bearer bearer-token',
      },
    } as any);

    expect(token).toBe('cookie-token');
  });

  it('cookie가 없으면 Authorization bearer token을 사용한다', () => {
    const token = resolveAdminSessionToken({
      headers: {
        authorization: 'Bearer bearer-token',
      },
    } as any);

    expect(token).toBe('bearer-token');
  });
});
