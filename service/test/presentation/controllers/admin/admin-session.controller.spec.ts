import { UnauthorizedException } from '@nestjs/common';
import { AdminSessionController } from '@presentation/controllers/admin/session.controller';

describe('AdminSessionController', () => {
  let controller: AdminSessionController;
  let adminSession: any;

  beforeEach(() => {
    jest.clearAllMocks();
    adminSession = {
      issueAdminToken: jest.fn().mockResolvedValue({
        token: 'access-token',
        username: 'admin',
      }),
    };

    controller = new AdminSessionController(adminSession);
  });

  it('세션 port가 null을 반환하면 UnauthorizedException을 던진다', async () => {
    adminSession.issueAdminToken.mockResolvedValue(null);

    await expect(
      controller.login({ username: 'admin', password: 'wrong' }),
    ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
  });

  it('정상 로그인 시 access token을 반환한다', async () => {
    const result = await controller.login({
      username: 'admin',
      password: 'secret',
    });

    expect(adminSession.issueAdminToken).toHaveBeenCalledWith({
      username: 'admin',
      password: 'secret',
    });
    expect(result).toEqual({
      token: 'access-token',
      username: 'admin',
    });
  });

  it('logout은 정상 종료한다', async () => {
    await expect(controller.logout()).resolves.toBeUndefined();
  });
});
