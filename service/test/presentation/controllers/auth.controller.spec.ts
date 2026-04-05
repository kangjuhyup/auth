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
    updateProfile: jest.fn(),
    revokeConsent: jest.fn(),
  } as any;
}

function createMockQueryPort(): jest.Mocked<AuthQueryPort> {
  return {
    getProfile: jest.fn(),
    getConsents: jest.fn(),
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

    await expect(controller.withdraw(tenant, authUser, dto)).resolves.toBeUndefined();
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

    await expect(controller.resetPassword(tenant, authUser, dto)).resolves.toBeUndefined();
    expect(commandPort.resetPassword).toHaveBeenCalledWith(
      tenant.id,
      authUser.userId,
      dto,
    );
  });

  it('getProfile은 tenant.id와 authUser.userId를 queryPort에 전달한다', async () => {
    const profile = { userId: 'user-1', username: 'john' } as any;
    queryPort.getProfile.mockResolvedValue(profile);

    await expect(controller.getProfile(tenant, authUser)).resolves.toBe(profile);
    expect(queryPort.getProfile).toHaveBeenCalledWith(
      tenant.id,
      authUser.userId,
    );
  });

  it('updateProfile은 tenant.id와 authUser.userId를 commandPort에 전달한다', async () => {
    const dto = { email: 'new@example.com' } as any;
    commandPort.updateProfile.mockResolvedValue(undefined);

    await expect(controller.updateProfile(tenant, authUser, dto)).resolves.toBeUndefined();
    expect(commandPort.updateProfile).toHaveBeenCalledWith(
      tenant.id,
      authUser.userId,
      dto,
    );
  });

  it('getConsents는 tenant.id와 authUser.userId를 queryPort에 전달한다', async () => {
    const consents = [{ clientId: 'client-1', grantedScopes: ['openid'] }] as any;
    queryPort.getConsents.mockResolvedValue(consents);

    await expect(controller.getConsents(tenant, authUser)).resolves.toBe(consents);
    expect(queryPort.getConsents).toHaveBeenCalledWith(
      tenant.id,
      authUser.userId,
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
