import { UnauthorizedException } from '@nestjs/common';
import { AdminSessionController } from '@presentation/controllers/admin/session.controller';
import { ADMIN_SESSION_COOKIE_NAME } from '@presentation/http/admin-session-cookie';

describe('AdminSessionController', () => {
  let controller: AdminSessionController;
  let adminSession: any;
  let config: any;
  let response: any;

  beforeEach(() => {
    jest.clearAllMocks();
    adminSession = {
      issueAdminToken: jest.fn().mockResolvedValue({
        token: 'access-token',
        username: 'admin',
      }),
      getAdminSession: jest.fn().mockResolvedValue({
        username: 'admin',
      }),
    };
    config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          ADMIN_SESSION_COOKIE_SECURE: 'true',
          ADMIN_SESSION_COOKIE_SAME_SITE: 'lax',
        };
        return values[key];
      }),
    };
    response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };

    controller = new AdminSessionController(adminSession, config);
  });

  it('세션 port가 null을 반환하면 UnauthorizedException을 던진다', async () => {
    adminSession.issueAdminToken.mockResolvedValue(null);

    await expect(
      controller.login({ username: 'admin', password: 'wrong' }, response),
    ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
  });

  it('정상 로그인 시 HttpOnly session cookie를 설정하고 token은 body로 반환하지 않는다', async () => {
    const result = await controller.login(
      {
        username: 'admin',
        password: 'secret',
      },
      response,
    );

    expect(adminSession.issueAdminToken).toHaveBeenCalledWith({
      username: 'admin',
      password: 'secret',
    });
    expect(response.cookie).toHaveBeenCalledWith(
      ADMIN_SESSION_COOKIE_NAME,
      'access-token',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      }),
    );
    expect(result).toEqual({
      username: 'admin',
    });
  });

  it('현재 세션 조회 시 cookie token으로 세션을 조회한다', async () => {
    const result = await controller.current({
      headers: { cookie: `${ADMIN_SESSION_COOKIE_NAME}=access-token` },
    } as any);

    expect(adminSession.getAdminSession).toHaveBeenCalledWith('access-token');
    expect(result).toEqual({ username: 'admin' });
  });

  it('logout은 정상 종료한다', async () => {
    await expect(controller.logout(response)).resolves.toBeUndefined();
    expect(response.clearCookie).toHaveBeenCalledWith(
      ADMIN_SESSION_COOKIE_NAME,
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      }),
    );
  });
});
