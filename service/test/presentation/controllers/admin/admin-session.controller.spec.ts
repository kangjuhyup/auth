import { HttpException, UnauthorizedException } from '@nestjs/common';
import { AdminSessionController } from '@presentation/controllers/admin/session.controller';
import { ADMIN_SESSION_COOKIE_NAME } from '@presentation/http/admin-session-cookie';

describe('AdminSessionController', () => {
  let controller: AdminSessionController;
  let adminSession: any;
  let config: any;
  let request: any;
  let response: any;

  beforeEach(() => {
    jest.clearAllMocks();
    adminSession = {
      issueAdminToken: jest.fn().mockResolvedValue({
        token: 'access-token',
        username: 'admin',
        passwordChangeRequired: false,
      }),
      getAdminSession: jest.fn().mockResolvedValue({
        userId: 'user-1',
        username: 'admin',
        passwordChangeRequired: false,
      }),
      changePassword: jest.fn().mockResolvedValue(undefined),
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
    request = { ip: '203.0.113.10', headers: {} };

    controller = new AdminSessionController(adminSession, config);
  });

  it('세션 port가 null을 반환하면 UnauthorizedException을 던진다', async () => {
    adminSession.issueAdminToken.mockResolvedValue(null);

    await expect(
      controller.login(
        { username: 'admin', password: 'wrong' },
        request,
        response,
      ),
    ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
  });

  it('정상 로그인 시 HttpOnly session cookie를 설정하고 token은 body로 반환하지 않는다', async () => {
    const result = await controller.login(
      {
        username: 'admin',
        password: 'secret',
      },
      request,
      response,
    );

    expect(adminSession.issueAdminToken).toHaveBeenCalledWith({
      username: 'admin',
      password: 'secret',
      ipAddress: '203.0.113.10',
      userAgent: undefined,
      correlationId: undefined,
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
      passwordChangeRequired: false,
    });
  });

  it('임시 비밀번호 관리자 로그인 시 passwordChangeRequired를 반환한다', async () => {
    adminSession.issueAdminToken.mockResolvedValue({
      token: 'access-token',
      username: 'admin',
      passwordChangeRequired: true,
    });

    await expect(
      controller.login(
        { username: 'admin', password: 'temporary123' },
        request,
        response,
      ),
    ).resolves.toEqual({
      username: 'admin',
      passwordChangeRequired: true,
    });
  });

  it('rate limit 차단 결과를 429 예외로 매핑한다', async () => {
    adminSession.issueAdminToken.mockResolvedValue({
      blocked: true,
      reason: 'rate_limited',
      retryAfterSec: 60,
    });

    await expect(
      controller.login(
        { username: 'admin', password: 'secret' },
        request,
        response,
      ),
    ).rejects.toMatchObject(new HttpException('Too many login attempts', 429));
  });

  it('임시 계정 잠금 결과를 423 예외로 매핑한다', async () => {
    adminSession.issueAdminToken.mockResolvedValue({
      blocked: true,
      reason: 'temporarily_locked',
      retryAfterSec: 900,
    });

    await expect(
      controller.login(
        { username: 'admin', password: 'secret' },
        request,
        response,
      ),
    ).rejects.toMatchObject(
      new HttpException('Account temporarily locked', 423),
    );
  });

  it('현재 세션 조회 시 cookie token으로 세션을 조회한다', async () => {
    const result = await controller.current({
      headers: { cookie: `${ADMIN_SESSION_COOKIE_NAME}=access-token` },
    } as any);

    expect(adminSession.getAdminSession).toHaveBeenCalledWith('access-token');
    expect(result).toEqual({
      username: 'admin',
      passwordChangeRequired: false,
    });
  });

  it('관리자 세션 비밀번호 변경을 port에 위임한다', async () => {
    await expect(
      controller.changePassword(
        {
          headers: { cookie: `${ADMIN_SESSION_COOKIE_NAME}=access-token` },
        } as any,
        {
          currentPassword: 'temporary123',
          newPassword: 'changed123',
        },
      ),
    ).resolves.toBeUndefined();

    expect(adminSession.changePassword).toHaveBeenCalledWith('access-token', {
      currentPassword: 'temporary123',
      newPassword: 'changed123',
    });
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
