import { InteractionCommandHandler } from '@application/commands/handlers/interaction-command.handler';

describe('InteractionCommandHandler', () => {
  let handler: InteractionCommandHandler;
  let userQuery: any;
  let oidcInteraction: any;
  const tenant = { id: 'tenant-1', code: 'acme', name: 'ACME' };

  beforeEach(() => {
    userQuery = {
      authenticate: jest.fn(),
      getMfaMethods: jest.fn(),
      verifyMfa: jest.fn(),
    };
    oidcInteraction = {
      getDetails: jest.fn(),
      completeLogin: jest.fn(),
    };
    handler = new InteractionCommandHandler(userQuery, oidcInteraction);
  });

  it('tenant가 없으면 400 응답을 반환한다', async () => {
    await expect(
      handler.submitLogin({
        tenantCode: 'acme',
        uid: 'uid-1',
        username: 'john',
        password: 'secret',
        req: {},
        res: {},
      }),
    ).resolves.toEqual({
      status: 400,
      body: { error: 'tenant_not_found' },
    });
  });

  it('인증 실패 시 401 응답을 반환한다', async () => {
    userQuery.authenticate.mockResolvedValue(null);

    await expect(
      handler.submitLogin({
        tenantCode: 'acme',
        uid: 'uid-1',
        username: 'john',
        password: 'wrong',
        req: {},
        res: {},
        tenant,
      }),
    ).resolves.toEqual({
      status: 401,
      body: { error: 'invalid_credentials' },
    });
  });

  it('MFA가 필요하면 pending session을 만들고 methods를 반환한다', async () => {
    userQuery.authenticate.mockResolvedValue({ userId: 'user-1' });
    userQuery.getMfaMethods.mockResolvedValue(['totp']);
    oidcInteraction.getDetails.mockResolvedValue({
      uid: 'uid-1',
      prompt: 'login',
      clientId: 'web-app',
      missingScopes: [],
      mfaRequired: true,
      idpList: [],
    });

    await expect(
      handler.submitLogin({
        tenantCode: 'acme',
        uid: 'uid-1',
        username: 'john',
        password: 'secret',
        req: {},
        res: {},
        tenant,
      }),
    ).resolves.toEqual({
      body: {
        success: true,
        mfaRequired: true,
        methods: ['totp'],
      },
    });
  });

  it('MFA가 필요 없으면 OIDC login completion을 호출한다', async () => {
    const req = {};
    const res = {};
    userQuery.authenticate.mockResolvedValue({ userId: 'user-1' });
    oidcInteraction.getDetails.mockResolvedValue({
      uid: 'uid-1',
      prompt: 'login',
      clientId: 'web-app',
      missingScopes: [],
      mfaRequired: false,
      idpList: [],
    });
    oidcInteraction.completeLogin.mockResolvedValue({
      redirectTo: '/interaction/continue',
    });

    await expect(
      handler.submitLogin({
        tenantCode: 'acme',
        uid: 'uid-1',
        username: 'john',
        password: 'secret',
        req,
        res,
        tenant,
      }),
    ).resolves.toEqual({
      body: {
        success: true,
        mfaRequired: false,
        redirectTo: '/interaction/continue',
      },
    });

    expect(oidcInteraction.completeLogin).toHaveBeenCalledWith({
      tenantCode: 'acme',
      req,
      res,
      userId: 'user-1',
    });
  });

  it('pending MFA가 없으면 400 응답을 반환한다', async () => {
    await expect(
      handler.submitMfa({
        tenantCode: 'acme',
        uid: 'missing',
        method: 'totp',
        code: '123456',
        req: {},
        res: {},
        rpId: 'auth.example.com',
        expectedOrigin: 'https://auth.example.com',
      }),
    ).resolves.toEqual({
      status: 400,
      body: { error: 'no_pending_mfa' },
    });
  });

  it('MFA 검증 성공 시 login completion을 호출하고 session을 제거한다', async () => {
    const req = {};
    const res = {};
    userQuery.authenticate.mockResolvedValue({ userId: 'user-1' });
    userQuery.getMfaMethods.mockResolvedValue(['totp']);
    userQuery.verifyMfa.mockResolvedValue(true);
    oidcInteraction.getDetails.mockResolvedValue({
      uid: 'uid-1',
      prompt: 'login',
      clientId: 'web-app',
      missingScopes: [],
      mfaRequired: true,
      idpList: [],
    });
    oidcInteraction.completeLogin.mockResolvedValue({
      redirectTo: '/interaction/done',
    });

    await handler.submitLogin({
      tenantCode: 'acme',
      uid: 'uid-1',
      username: 'john',
      password: 'secret',
      req,
      res,
      tenant,
    });

    await expect(
      handler.submitMfa({
        tenantCode: 'acme',
        uid: 'uid-1',
        method: 'totp',
        code: '123456',
        req,
        res,
        rpId: 'auth.example.com',
        expectedOrigin: 'https://auth.example.com',
      }),
    ).resolves.toEqual({
      body: {
        success: true,
        redirectTo: '/interaction/done',
      },
    });

    expect(userQuery.verifyMfa).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      userId: 'user-1',
      method: 'totp',
      code: '123456',
      webauthnResponse: undefined,
      rpId: 'auth.example.com',
      expectedOrigin: 'https://auth.example.com',
    });

    await expect(
      handler.submitMfa({
        tenantCode: 'acme',
        uid: 'uid-1',
        method: 'totp',
        code: '123456',
        req,
        res,
        rpId: 'auth.example.com',
        expectedOrigin: 'https://auth.example.com',
      }),
    ).resolves.toEqual({
      status: 400,
      body: { error: 'no_pending_mfa' },
    });
  });
});
