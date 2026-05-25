import { InteractionCommandHandler } from '@application/commands/handlers/interaction-command.handler';

describe('InteractionCommandHandler', () => {
  let handler: InteractionCommandHandler;
  let userQuery: any;
  let oidcInteraction: any;
  let loginAttemptPolicy: any;
  let metrics: any;
  let authCommand: any;
  let auditRecorder: any;
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
    loginAttemptPolicy = {
      consumeAttempt: jest.fn().mockResolvedValue({ allowed: true }),
      recordFailure: jest.fn().mockResolvedValue({
        failureCount: 1,
        temporarilyLocked: false,
      }),
      recordSuccess: jest.fn().mockResolvedValue(undefined),
    };
    metrics = {
      incrementCounter: jest.fn(),
      observeLatency: jest.fn(),
      snapshot: jest.fn(),
    };
    authCommand = {
      changePassword: jest.fn().mockResolvedValue(undefined),
      beginTotpEnrollment: jest.fn().mockResolvedValue({
        secret: 'totp-secret',
        otpauthUrl: 'otpauth://totp/Auth:john',
      }),
      confirmTotpEnrollment: jest.fn().mockResolvedValue({
        recoveryCodes: ['code-1', 'code-2'],
      }),
    };
    auditRecorder = {
      recordAdminAction: jest.fn().mockResolvedValue(undefined),
    };
    handler = new InteractionCommandHandler(
      userQuery,
      oidcInteraction,
      loginAttemptPolicy,
      metrics,
      authCommand,
      auditRecorder,
    );
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
    expect(loginAttemptPolicy.recordFailure).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      username: 'john',
      ipAddress: undefined,
      scope: 'interaction',
    });
    expect(metrics.incrementCounter).toHaveBeenCalledWith(
      'login_failure_total',
      {
        tenantCode: 'acme',
        reason: 'invalid_credentials',
      },
    );
  });

  it('인증 실패 급증으로 잠금이 발생하면 suspicious login audit을 기록한다', async () => {
    userQuery.authenticate.mockResolvedValue(null);
    loginAttemptPolicy.recordFailure.mockResolvedValue({
      failureCount: 5,
      temporarilyLocked: true,
      retryAfterSec: 900,
    });

    await handler.submitLogin({
      tenantCode: 'acme',
      uid: 'uid-1',
      username: 'john',
      password: 'wrong',
      ipAddress: '203.0.113.10',
      userAgent: 'jest',
      correlationId: 'req-1',
      req: {},
      res: {},
      tenant,
    });

    expect(auditRecorder.recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        category: 'SECURITY',
        severity: 'WARN',
        action: 'ACCESS_DENIED',
        resourceType: 'login-risk',
        resourceId: 'john',
        success: false,
        reason: 'FailureSpikeDetected',
        metadata: expect.objectContaining({
          source: 'interaction',
          signal: 'failure_spike',
          failureCount: 5,
          retryAfterSec: 900,
        }),
        auditContext: expect.objectContaining({
          actorUsername: 'john',
          ipAddress: '203.0.113.10',
          userAgent: 'jest',
          correlationId: 'req-1',
        }),
      }),
    );
  });

  it('rate limit 상태면 인증을 수행하지 않고 429 응답을 반환한다', async () => {
    loginAttemptPolicy.consumeAttempt.mockResolvedValue({
      allowed: false,
      reason: 'rate_limited',
      retryAfterSec: 60,
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
      status: 429,
      body: {
        error: 'too_many_login_attempts',
        retryAfterSec: 60,
      },
    });
    expect(userQuery.authenticate).not.toHaveBeenCalled();
    expect(metrics.incrementCounter).toHaveBeenCalledWith(
      'login_failure_total',
      {
        tenantCode: 'acme',
        reason: 'rate_limited',
      },
    );
  });

  it('임시 계정 잠금 상태면 인증을 수행하지 않고 423 응답을 반환한다', async () => {
    loginAttemptPolicy.consumeAttempt.mockResolvedValue({
      allowed: false,
      reason: 'temporarily_locked',
      retryAfterSec: 900,
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
      status: 423,
      body: {
        error: 'account_temporarily_locked',
        retryAfterSec: 900,
      },
    });
    expect(userQuery.authenticate).not.toHaveBeenCalled();
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

  it('임시 비밀번호 로그인은 토큰 발급 전에 비밀번호 변경을 요구한다', async () => {
    userQuery.authenticate.mockResolvedValue({
      userId: 'user-1',
      mfaEnabled: false,
      passwordChangeRequired: true,
    });

    await expect(
      handler.submitLogin({
        tenantCode: 'acme',
        uid: 'uid-1',
        username: 'john',
        password: 'temporary123',
        req: {},
        res: {},
        tenant,
      }),
    ).resolves.toEqual({
      body: {
        success: true,
        passwordChangeRequired: true,
      },
    });

    expect(oidcInteraction.completeLogin).not.toHaveBeenCalled();
  });

  it('임시 비밀번호 변경 후 MFA가 필요 없으면 login completion을 호출한다', async () => {
    const req = {};
    const res = {};
    userQuery.authenticate.mockResolvedValue({
      userId: 'user-1',
      mfaEnabled: false,
      passwordChangeRequired: true,
    });
    oidcInteraction.getDetails.mockResolvedValue({
      uid: 'uid-1',
      prompt: 'login',
      clientId: 'web-app',
      missingScopes: [],
      mfaRequired: false,
      idpList: [],
    });
    oidcInteraction.completeLogin.mockResolvedValue({
      redirectTo: '/interaction/done',
    });

    await handler.submitLogin({
      tenantCode: 'acme',
      uid: 'uid-1',
      username: 'john',
      password: 'temporary123',
      req,
      res,
      tenant,
    });

    await expect(
      handler.submitPasswordChange({
        tenantCode: 'acme',
        uid: 'uid-1',
        currentPassword: 'temporary123',
        newPassword: 'new-password123',
        req,
        res,
        tenant,
      }),
    ).resolves.toEqual({
      body: {
        success: true,
        mfaRequired: false,
        redirectTo: '/interaction/done',
      },
    });

    expect(authCommand.changePassword).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      {
        currentPassword: 'temporary123',
        newPassword: 'new-password123',
      },
    );
  });

  it('임시 비밀번호 변경 후 MFA가 필요하면 MFA 단계로 전환한다', async () => {
    userQuery.authenticate.mockResolvedValue({
      userId: 'user-1',
      mfaEnabled: true,
      passwordChangeRequired: true,
    });
    userQuery.getMfaMethods.mockResolvedValue(['totp']);
    oidcInteraction.getDetails.mockResolvedValue({
      uid: 'uid-1',
      prompt: 'login',
      clientId: 'web-app',
      missingScopes: [],
      mfaRequired: false,
      idpList: [],
    });

    await handler.submitLogin({
      tenantCode: 'acme',
      uid: 'uid-1',
      username: 'john',
      password: 'temporary123',
      req: {},
      res: {},
      tenant,
    });

    await expect(
      handler.submitPasswordChange({
        tenantCode: 'acme',
        uid: 'uid-1',
        currentPassword: 'temporary123',
        newPassword: 'new-password123',
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

    expect(oidcInteraction.completeLogin).not.toHaveBeenCalled();
  });

  it('임시 비밀번호 변경 세션이 없으면 400 응답을 반환한다', async () => {
    await expect(
      handler.submitPasswordChange({
        tenantCode: 'acme',
        uid: 'missing',
        currentPassword: 'temporary123',
        newPassword: 'new-password123',
        req: {},
        res: {},
        tenant,
      }),
    ).resolves.toEqual({
      status: 400,
      body: { error: 'no_pending_password_change' },
    });
  });

  it('사용자 MFA가 활성화되어 있으면 정책 MFA가 없어도 MFA를 요구한다', async () => {
    userQuery.authenticate.mockResolvedValue({
      userId: 'user-1',
      mfaEnabled: true,
    });
    userQuery.getMfaMethods.mockResolvedValue(['totp']);
    oidcInteraction.getDetails.mockResolvedValue({
      uid: 'uid-1',
      prompt: 'login',
      clientId: 'web-app',
      missingScopes: [],
      mfaRequired: false,
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

    expect(oidcInteraction.completeLogin).not.toHaveBeenCalled();
  });

  it('MFA가 필요한데 등록된 수단이 없으면 토큰 발급 전에 MFA 등록을 요구한다', async () => {
    userQuery.authenticate.mockResolvedValue({
      userId: 'user-1',
      mfaEnabled: true,
    });
    userQuery.getMfaMethods.mockResolvedValue([]);
    oidcInteraction.getDetails.mockResolvedValue({
      uid: 'uid-1',
      prompt: 'login',
      clientId: 'web-app',
      missingScopes: [],
      mfaRequired: false,
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
        mfaEnrollmentRequired: true,
        methods: ['totp'],
      },
    });

    expect(metrics.incrementCounter).toHaveBeenCalledWith(
      'mfa_enrollment_required_total',
      {
        tenantCode: 'acme',
        method: 'totp',
      },
    );
    expect(oidcInteraction.completeLogin).not.toHaveBeenCalled();
  });

  it('pending MFA 등록 세션에서 TOTP 등록을 시작한다', async () => {
    userQuery.authenticate.mockResolvedValue({
      userId: 'user-1',
      mfaEnabled: true,
    });
    userQuery.getMfaMethods.mockResolvedValue([]);
    oidcInteraction.getDetails.mockResolvedValue({
      uid: 'uid-1',
      prompt: 'login',
      clientId: 'web-app',
      missingScopes: [],
      mfaRequired: false,
      idpList: [],
    });

    await handler.submitLogin({
      tenantCode: 'acme',
      uid: 'uid-1',
      username: 'john',
      password: 'secret',
      req: {},
      res: {},
      tenant,
    });

    await expect(
      handler.beginTotpEnrollment({
        tenantCode: 'acme',
        uid: 'uid-1',
        tenant,
      }),
    ).resolves.toEqual({
      body: {
        success: true,
        secret: 'totp-secret',
        otpauthUrl: 'otpauth://totp/Auth:john',
      },
    });

    expect(authCommand.beginTotpEnrollment).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
    );
    expect(oidcInteraction.completeLogin).not.toHaveBeenCalled();
  });

  it('TOTP 등록 확인이 성공하면 복구 코드를 반환하고 OIDC login completion을 호출한다', async () => {
    const req = {};
    const res = {};
    userQuery.authenticate.mockResolvedValue({
      userId: 'user-1',
      mfaEnabled: true,
    });
    userQuery.getMfaMethods.mockResolvedValue([]);
    oidcInteraction.getDetails.mockResolvedValue({
      uid: 'uid-1',
      prompt: 'login',
      clientId: 'web-app',
      missingScopes: [],
      mfaRequired: false,
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
      handler.confirmTotpEnrollment({
        tenantCode: 'acme',
        uid: 'uid-1',
        code: '123456',
        req,
        res,
        tenant,
      }),
    ).resolves.toEqual({
      body: {
        success: true,
        recoveryCodes: ['code-1', 'code-2'],
        redirectTo: '/interaction/done',
      },
    });

    expect(authCommand.confirmTotpEnrollment).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      { code: '123456' },
    );
    expect(oidcInteraction.completeLogin).toHaveBeenCalledWith({
      tenantCode: 'acme',
      req,
      res,
      userId: 'user-1',
    });
  });

  it('TOTP 등록 확인 코드가 틀리면 login completion을 호출하지 않는다', async () => {
    userQuery.authenticate.mockResolvedValue({
      userId: 'user-1',
      mfaEnabled: true,
    });
    userQuery.getMfaMethods.mockResolvedValue([]);
    authCommand.confirmTotpEnrollment.mockRejectedValue(
      new Error('InvalidTotpCode'),
    );
    oidcInteraction.getDetails.mockResolvedValue({
      uid: 'uid-1',
      prompt: 'login',
      clientId: 'web-app',
      missingScopes: [],
      mfaRequired: false,
      idpList: [],
    });

    await handler.submitLogin({
      tenantCode: 'acme',
      uid: 'uid-1',
      username: 'john',
      password: 'secret',
      req: {},
      res: {},
      tenant,
    });

    await expect(
      handler.confirmTotpEnrollment({
        tenantCode: 'acme',
        uid: 'uid-1',
        code: '000000',
        req: {},
        res: {},
        tenant,
      }),
    ).resolves.toEqual({
      status: 401,
      body: { error: 'invalid_totp_code' },
    });

    expect(oidcInteraction.completeLogin).not.toHaveBeenCalled();
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
    expect(loginAttemptPolicy.recordSuccess).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      username: 'john',
      ipAddress: undefined,
      scope: 'interaction',
    });
    expect(metrics.incrementCounter).toHaveBeenCalledWith(
      'login_success_total',
      { tenantCode: 'acme' },
    );
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

  it('recovery code MFA 검증 성공 시 recovery code 사용 audit을 기록한다', async () => {
    const req = {};
    const res = {};
    userQuery.authenticate.mockResolvedValue({ userId: 'user-1' });
    userQuery.getMfaMethods.mockResolvedValue(['recovery_code']);
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

    await handler.submitMfa({
      tenantCode: 'acme',
      uid: 'uid-1',
      method: 'recovery_code',
      code: 'RC-1234',
      ipAddress: '203.0.113.10',
      userAgent: 'jest',
      correlationId: 'req-1',
      req,
      res,
      rpId: 'auth.example.com',
      expectedOrigin: 'https://auth.example.com',
    });

    expect(auditRecorder.recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        category: 'SECURITY',
        severity: 'INFO',
        action: 'UPDATE',
        resourceType: 'mfa-recovery-code',
        resourceId: 'user-1',
        success: true,
        reason: 'RecoveryCodeUsed',
        metadata: { method: 'recovery_code' },
        auditContext: {
          actorUserId: 'user-1',
          ipAddress: '203.0.113.10',
          userAgent: 'jest',
          correlationId: 'req-1',
        },
      }),
    );
  });
});
