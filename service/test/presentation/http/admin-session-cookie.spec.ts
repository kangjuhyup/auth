import {
  ADMIN_REFRESH_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_NAME,
  buildAdminRefreshCookieOptions,
  buildAdminSessionCookieOptions,
  resolveAdminRefreshToken,
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

  it('refresh cookie는 별도 maxAge 기본값을 사용한다', () => {
    const options = buildAdminRefreshCookieOptions(makeConfig({}));

    expect(options.maxAge).toBe(14 * 24 * 60 * 60 * 1000);
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

  it('refresh cookie를 별도로 읽는다', () => {
    const token = resolveAdminRefreshToken({
      headers: {
        cookie: `${ADMIN_REFRESH_COOKIE_NAME}=refresh-token`,
      },
    } as any);

    expect(token).toBe('refresh-token');
  });
});
