import { AuthController } from '@presentation/controllers/auth.controller';
import type { AuthCommandPort } from '@application/commands/ports/auth-command.port';
import type { AuthQueryPort } from '@application/queries/ports';
import {
  makeAuthenticatedUser,
  makeTenantContext,
} from './support/controller-test-helpers';

function createMockCommandPort(): jest.Mocked<AuthCommandPort> {
  return {
    signup: jest.fn(),
    withdraw: jest.fn(),
    changePassword: jest.fn(),
    requestPasswordReset: jest.fn(),
    resetPassword: jest.fn(),
    requestEmailVerification: jest.fn(),
    verifyEmail: jest.fn(),
    requestPhoneVerification: jest.fn(),
    verifyPhone: jest.fn(),
    beginTotpEnrollment: jest.fn(),
    confirmTotpEnrollment: jest.fn(),
    disableTotp: jest.fn(),
    updateMfaPreference: jest.fn(),
    startIdentityLink: jest.fn(),
    completeIdentityLink: jest.fn(),
    unlinkIdentity: jest.fn(),
    updateProfile: jest.fn(),
    revokeConsent: jest.fn(),
  } as any;
}

function createMockQueryPort(): jest.Mocked<AuthQueryPort> {
  return {
    getProfile: jest.fn(),
    getConsents: jest.fn(),
    getIdentityLinks: jest.fn(),
  } as any;
}

describe('AuthController', () => {
  let controller: AuthController;
  let commandPort: jest.Mocked<AuthCommandPort>;
  let queryPort: jest.Mocked<AuthQueryPort>;

  const tenant = makeTenantContext();
  const authUser = makeAuthenticatedUser();

  beforeEach(() => {
    jest.clearAllMocks();
    commandPort = createMockCommandPort();
    queryPort = createMockQueryPort();
    controller = new AuthController(commandPort, queryPort);
  });

  it('signup은 tenant.id와 dto를 commandPort에 전달한다', async () => {
    const dto = { username: 'john', password: 'secret123' } as any;
    const result = { userId: 'user-1' };
    commandPort.signup.mockResolvedValue(result);

    await expect(controller.signup(tenant, dto)).resolves.toBe(result);
    expect(commandPort.signup).toHaveBeenCalledWith(tenant.id, dto);
  });

  it('withdraw는 tenant.id와 authUser.userId를 commandPort에 전달한다', async () => {
    const dto = { password: 'secret123' } as any;
    commandPort.withdraw.mockResolvedValue(undefined);

    await expect(
      controller.withdraw(tenant, authUser, dto),
    ).resolves.toBeUndefined();
    expect(commandPort.withdraw).toHaveBeenCalledWith(
      tenant.id,
      authUser.userId,
      dto,
    );
  });

  it('changePassword는 tenant.id와 authUser.userId를 commandPort에 전달한다', async () => {
    const dto = { currentPassword: 'old', newPassword: 'new' } as any;
    commandPort.changePassword.mockResolvedValue(undefined);

    await expect(
      controller.changePassword(tenant, authUser, dto),
    ).resolves.toBeUndefined();
    expect(commandPort.changePassword).toHaveBeenCalledWith(
      tenant.id,
      authUser.userId,
      dto,
    );
  });

  it('requestPasswordReset은 tenant.id와 dto를 commandPort에 전달한다', async () => {
    const dto = { email: 'john@example.com' } as any;
    commandPort.requestPasswordReset.mockResolvedValue(undefined);

    await expect(
      controller.requestPasswordReset(tenant, dto),
    ).resolves.toBeUndefined();
    expect(commandPort.requestPasswordReset).toHaveBeenCalledWith(
      tenant.id,
      dto,
    );
  });

  it('resetPassword는 tenant.id와 authUser.userId를 commandPort에 전달한다', async () => {
    const dto = { token: 'otp-token', newPassword: 'new' } as any;
    commandPort.resetPassword.mockResolvedValue(undefined);

    await expect(
      controller.resetPassword(tenant, authUser, dto),
    ).resolves.toBeUndefined();
    expect(commandPort.resetPassword).toHaveBeenCalledWith(
      tenant.id,
      authUser.userId,
      dto,
    );
  });

  it('requestEmailVerification은 tenant.id와 authUser.userId를 commandPort에 전달한다', async () => {
    commandPort.requestEmailVerification.mockResolvedValue(undefined);

    await expect(
      controller.requestEmailVerification(tenant, authUser),
    ).resolves.toBeUndefined();
    expect(commandPort.requestEmailVerification).toHaveBeenCalledWith(
      tenant.id,
      authUser.userId,
    );
  });

  it('verifyEmail은 tenant.id와 authUser.userId, dto를 commandPort에 전달한다', async () => {
    const dto = { token: 'otp-token' } as any;
    commandPort.verifyEmail.mockResolvedValue(undefined);

    await expect(
      controller.verifyEmail(tenant, authUser, dto),
    ).resolves.toBeUndefined();
    expect(commandPort.verifyEmail).toHaveBeenCalledWith(
      tenant.id,
      authUser.userId,
      dto,
    );
  });

  it('requestPhoneVerification은 tenant.id와 authUser.userId를 commandPort에 전달한다', async () => {
    commandPort.requestPhoneVerification.mockResolvedValue(undefined);

    await expect(
      controller.requestPhoneVerification(tenant, authUser),
    ).resolves.toBeUndefined();
    expect(commandPort.requestPhoneVerification).toHaveBeenCalledWith(
      tenant.id,
      authUser.userId,
    );
  });

  it('verifyPhone은 tenant.id와 authUser.userId, dto를 commandPort에 전달한다', async () => {
    const dto = { token: 'otp-token' } as any;
    commandPort.verifyPhone.mockResolvedValue(undefined);

    await expect(
      controller.verifyPhone(tenant, authUser, dto),
    ).resolves.toBeUndefined();
    expect(commandPort.verifyPhone).toHaveBeenCalledWith(
      tenant.id,
      authUser.userId,
      dto,
    );
  });

  it('beginTotpEnrollment는 tenant.id와 authUser.userId를 commandPort에 전달한다', async () => {
    const result = {
      secret: 'JBSWY3DPEHPK3PXP',
      otpauthUrl: 'otpauth://totp/Auth%3Ajohn',
    };
    commandPort.beginTotpEnrollment.mockResolvedValue(result);

    await expect(
      controller.beginTotpEnrollment(tenant, authUser),
    ).resolves.toBe(result);
    expect(commandPort.beginTotpEnrollment).toHaveBeenCalledWith(
      tenant.id,
      authUser.userId,
    );
  });

  it('confirmTotpEnrollment는 tenant.id와 authUser.userId, dto를 commandPort에 전달한다', async () => {
    const dto = { code: '123456' } as any;
    const result = { recoveryCodes: ['recovery-code'] };
    commandPort.confirmTotpEnrollment.mockResolvedValue(result);

    await expect(
      controller.confirmTotpEnrollment(tenant, authUser, dto),
    ).resolves.toBe(result);
    expect(commandPort.confirmTotpEnrollment).toHaveBeenCalledWith(
      tenant.id,
      authUser.userId,
      dto,
    );
  });

  it('disableTotp는 tenant.id와 authUser.userId를 commandPort에 전달한다', async () => {
    commandPort.disableTotp.mockResolvedValue(undefined);

    await expect(
      controller.disableTotp(tenant, authUser),
    ).resolves.toBeUndefined();
    expect(commandPort.disableTotp).toHaveBeenCalledWith(
      tenant.id,
      authUser.userId,
    );
  });

  it('updateMfaPreference는 tenant.id와 authUser.userId, dto를 commandPort에 전달한다', async () => {
    const dto = { enabled: true };
    commandPort.updateMfaPreference.mockResolvedValue(undefined);

    await expect(
      controller.updateMfaPreference(tenant, authUser, dto),
    ).resolves.toBeUndefined();
    expect(commandPort.updateMfaPreference).toHaveBeenCalledWith(
      tenant.id,
      authUser.userId,
      dto,
    );
  });

  it('getProfile은 tenant.id와 authUser.userId를 queryPort에 전달한다', async () => {
    const profile = { userId: 'user-1', username: 'john' } as any;
    queryPort.getProfile.mockResolvedValue(profile);

    await expect(controller.getProfile(tenant, authUser)).resolves.toBe(
      profile,
    );
    expect(queryPort.getProfile).toHaveBeenCalledWith(
      tenant.id,
      authUser.userId,
    );
  });

  it('updateProfile은 tenant.id와 authUser.userId를 commandPort에 전달한다', async () => {
    const dto = { email: 'new@example.com' } as any;
    commandPort.updateProfile.mockResolvedValue(undefined);

    await expect(
      controller.updateProfile(tenant, authUser, dto),
    ).resolves.toBeUndefined();
    expect(commandPort.updateProfile).toHaveBeenCalledWith(
      tenant.id,
      authUser.userId,
      dto,
    );
  });

  it('getConsents는 tenant.id와 authUser.userId를 queryPort에 전달한다', async () => {
    const consents = [
      { clientId: 'client-1', grantedScopes: ['openid'] },
    ] as any;
    queryPort.getConsents.mockResolvedValue(consents);

    await expect(controller.getConsents(tenant, authUser)).resolves.toBe(
      consents,
    );
    expect(queryPort.getConsents).toHaveBeenCalledWith(
      tenant.id,
      authUser.userId,
    );
  });

  it('getIdentityLinks는 tenant.id와 authUser.userId를 queryPort에 전달한다', async () => {
    const links = [{ id: 'identity-1', provider: 'google' }] as any;
    queryPort.getIdentityLinks.mockResolvedValue(links);

    await expect(controller.getIdentityLinks(tenant, authUser)).resolves.toBe(
      links,
    );
    expect(queryPort.getIdentityLinks).toHaveBeenCalledWith(
      tenant.id,
      authUser.userId,
    );
  });

  it('startIdentityLink는 callback URL을 구성해 commandPort에 전달한다', async () => {
    const result = {
      authorizationUrl: 'https://idp.example/authorize?state=state-1',
    };
    const req = {
      protocol: 'https',
      get: jest.fn().mockReturnValue('auth.example'),
    } as any;
    commandPort.startIdentityLink.mockResolvedValue(result);

    await expect(
      controller.startIdentityLink(
        tenant,
        authUser,
        'google',
        { returnTo: '/admin/security' },
        req,
      ),
    ).resolves.toBe(result);
    expect(commandPort.startIdentityLink).toHaveBeenCalledWith(
      tenant.id,
      authUser.userId,
      {
        provider: 'google',
        tenantCode: tenant.code,
        redirectUri:
          'https://auth.example/auth/identity-links/google/callback?tenantCode=acme',
        returnTo: '/admin/security',
      },
    );
  });

  it('completeIdentityLink는 command 결과로 redirect 한다', async () => {
    const res = { redirect: jest.fn() } as any;
    commandPort.completeIdentityLink.mockResolvedValue({
      redirectTo: '/admin/security?identityLinked=google',
    });

    await controller.completeIdentityLink(
      'google',
      { state: 'state-1', code: 'code-1' },
      res,
    );

    expect(commandPort.completeIdentityLink).toHaveBeenCalledWith({
      provider: 'google',
      state: 'state-1',
      code: 'code-1',
      error: undefined,
    });
    expect(res.redirect).toHaveBeenCalledWith(
      '/admin/security?identityLinked=google',
    );
  });

  it('unlinkIdentity는 tenant.id와 authUser.userId, identityId를 commandPort에 전달한다', async () => {
    commandPort.unlinkIdentity.mockResolvedValue(undefined);

    await expect(
      controller.unlinkIdentity(tenant, authUser, 'identity-1'),
    ).resolves.toBeUndefined();
    expect(commandPort.unlinkIdentity).toHaveBeenCalledWith(
      tenant.id,
      authUser.userId,
      'identity-1',
    );
  });

  it('revokeConsent는 tenant.id와 authUser.userId, clientId를 commandPort에 전달한다', async () => {
    commandPort.revokeConsent.mockResolvedValue(undefined);

    await expect(
      controller.revokeConsent(tenant, authUser, 'client-1'),
    ).resolves.toBeUndefined();
    expect(commandPort.revokeConsent).toHaveBeenCalledWith(
      tenant.id,
      authUser.userId,
      'client-1',
    );
  });
});
