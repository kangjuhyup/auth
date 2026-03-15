import { AuthCommandHandler } from '@application/commands/handlers/auth-command.handler';
import type { UserWriteRepositoryPort } from '@application/commands/ports/user-write-repository.port';
import type {
  PasswordHashPort,
  HashResult,
  HashPolicy,
} from '@application/ports/password-hash.port';
import type { OtpHashPort } from '@application/ports/otp-hash.port';
import type { OtpTokenPort, OtpTokenRecord } from '@application/ports/otp-token.port';
import type { NotificationPort } from '@application/ports/notification.port';
import type { ConfigService } from '@nestjs/config';
import { UserModel } from '@domain/models/user';
import { UserCredentialModel } from '@domain/models/user-credential';

function makeActiveUser(overrides?: Partial<Parameters<typeof UserModel.of>[0]>): UserModel {
  const credential = UserCredentialModel.password({
    secretHash: 'hashed-pw',
    hashAlg: 'argon2id',
    hashParams: null,
    hashVersion: 1,
  });
  return UserModel.of({
    id: 'user-1',
    tenantId: 'tenant-1',
    username: 'john',
    email: null,
    emailVerified: false,
    phone: null,
    phoneVerified: false,
    status: 'ACTIVE',
    passwordCredential: credential,
    ...overrides,
  });
}

function createMockUserWriteRepo(): jest.Mocked<UserWriteRepositoryPort> {
  return {
    findById: jest.fn().mockResolvedValue(makeActiveUser()),
    findByUsername: jest.fn().mockResolvedValue(makeActiveUser()),
    findByContact: jest.fn().mockResolvedValue(makeActiveUser()),
    save: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockPasswordHash(): jest.Mocked<PasswordHashPort> {
  const result: HashResult = {
    alg: 'argon2id',
    params: { timeCost: 3 },
    version: 1,
    hash: 'hashed-password',
  };
  return {
    defaultPolicy: jest.fn().mockReturnValue({ alg: 'argon2id', params: {}, version: 1 } as HashPolicy),
    hash: jest.fn().mockResolvedValue(result),
    verify: jest.fn().mockResolvedValue(true),
  };
}

function createMockOtpHash(): jest.Mocked<OtpHashPort> {
  return {
    generateToken: jest.fn().mockReturnValue('plain-token'),
    hash: jest.fn().mockReturnValue('hashed-token'),
  };
}

function createMockOtpToken(): jest.Mocked<OtpTokenPort> {
  const record: OtpTokenRecord = {
    id: 'token-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    purpose: 'PASSWORD_RESET',
    requestId: 'request-1',
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
  };
  return {
    create: jest.fn().mockResolvedValue(undefined),
    findValidByTokenHash: jest.fn().mockResolvedValue(record),
    consume: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockNotification(): jest.Mocked<NotificationPort> {
  return {
    notify: jest.fn().mockResolvedValue(undefined),
  };
}

describe('AuthCommandHandler', () => {
  let handler: AuthCommandHandler;
  let userWriteRepo: jest.Mocked<UserWriteRepositoryPort>;
  let passwordHash: jest.Mocked<PasswordHashPort>;
  let otpHash: jest.Mocked<OtpHashPort>;
  let otpToken: jest.Mocked<OtpTokenPort>;
  let notification: jest.Mocked<NotificationPort>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();
    userWriteRepo = createMockUserWriteRepo();
    passwordHash = createMockPasswordHash();
    otpHash = createMockOtpHash();
    otpToken = createMockOtpToken();
    notification = createMockNotification();
    configService = {
      getOrThrow: jest.fn().mockReturnValue('600'),
    } as any;

    handler = new AuthCommandHandler(
      userWriteRepo,
      passwordHash,
      otpHash,
      otpToken,
      notification,
      configService,
    );
  });

  describe('signup', () => {
    const tenantId = 'tenant-1';
    const dto = { username: 'john', password: 'secure123' };

    it('hash → userWriteRepo.save 순서로 호출된다', async () => {
      await handler.signup(tenantId, dto as any);

      expect(passwordHash.hash).toHaveBeenCalledTimes(1);
      expect(userWriteRepo.save).toHaveBeenCalledTimes(1);
      expect(passwordHash.hash.mock.invocationCallOrder[0]).toBeLessThan(
        userWriteRepo.save.mock.invocationCallOrder[0],
      );
    });

    it('userId를 반환한다', async () => {
      const result = await handler.signup(tenantId, dto as any);
      expect(result.userId).toBeDefined();
      expect(typeof result.userId).toBe('string');
    });
  });

  describe('withdraw', () => {
    it('findById → verify → save 순서로 호출된다', async () => {
      passwordHash.verify.mockResolvedValue(true);

      await handler.withdraw('tenant-1', 'user-1', { password: 'pw' } as any);

      expect(userWriteRepo.findById).toHaveBeenCalledTimes(1);
      expect(passwordHash.verify).toHaveBeenCalledTimes(1);
      expect(userWriteRepo.save).toHaveBeenCalledTimes(1);

      expect(userWriteRepo.findById.mock.invocationCallOrder[0]).toBeLessThan(
        passwordHash.verify.mock.invocationCallOrder[0],
      );
      expect(passwordHash.verify.mock.invocationCallOrder[0]).toBeLessThan(
        userWriteRepo.save.mock.invocationCallOrder[0],
      );
    });

    it('verify 실패 시 save를 호출하지 않는다', async () => {
      passwordHash.verify.mockResolvedValue(false);

      await expect(
        handler.withdraw('tenant-1', 'user-1', { password: 'pw' } as any),
      ).rejects.toThrow();

      expect(userWriteRepo.save).not.toHaveBeenCalled();
    });

    it('유저가 없으면(UserNotFound) verify/save를 호출하지 않는다', async () => {
      userWriteRepo.findById.mockResolvedValue(undefined);

      await expect(
        handler.withdraw('tenant-1', 'user-1', { password: 'pw' } as any),
      ).rejects.toThrow();

      expect(passwordHash.verify).not.toHaveBeenCalled();
      expect(userWriteRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('findById → verify → hash → save 순서로 호출된다', async () => {
      await handler.changePassword('tenant-1', 'user-1', {
        currentPassword: 'old',
        newPassword: 'new',
      } as any);

      expect(userWriteRepo.findById).toHaveBeenCalledTimes(1);
      expect(passwordHash.verify).toHaveBeenCalledTimes(1);
      expect(passwordHash.hash).toHaveBeenCalledTimes(1);
      expect(userWriteRepo.save).toHaveBeenCalledTimes(1);

      expect(userWriteRepo.findById.mock.invocationCallOrder[0]).toBeLessThan(
        passwordHash.verify.mock.invocationCallOrder[0],
      );
      expect(passwordHash.verify.mock.invocationCallOrder[0]).toBeLessThan(
        passwordHash.hash.mock.invocationCallOrder[0],
      );
      expect(passwordHash.hash.mock.invocationCallOrder[0]).toBeLessThan(
        userWriteRepo.save.mock.invocationCallOrder[0],
      );
    });

    it('verify 실패 시 save를 호출하지 않는다', async () => {
      passwordHash.verify.mockResolvedValue(false);

      await expect(
        handler.changePassword('tenant-1', 'user-1', {
          currentPassword: 'wrong',
          newPassword: 'new',
        } as any),
      ).rejects.toThrow();

      expect(userWriteRepo.save).not.toHaveBeenCalled();
    });

    it('유저가 없으면(UserNotFound) verify/hash/save를 호출하지 않는다', async () => {
      userWriteRepo.findById.mockResolvedValue(undefined);

      await expect(
        handler.changePassword('tenant-1', 'user-1', {
          currentPassword: 'old',
          newPassword: 'new',
        } as any),
      ).rejects.toThrow();

      expect(passwordHash.verify).not.toHaveBeenCalled();
      expect(passwordHash.hash).not.toHaveBeenCalled();
      expect(userWriteRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('requestPasswordReset', () => {
    it('findByContact → generateToken → hash → otpToken.create → notify 순서로 호출된다', async () => {
      await handler.requestPasswordReset('tenant-1', {
        email: 'john@example.com',
      } as any);

      expect(userWriteRepo.findByContact).toHaveBeenCalledTimes(1);
      expect(otpHash.generateToken).toHaveBeenCalledTimes(1);
      expect(otpHash.hash).toHaveBeenCalledTimes(1);
      expect(otpToken.create).toHaveBeenCalledTimes(1);

      expect(userWriteRepo.findByContact.mock.invocationCallOrder[0]).toBeLessThan(
        otpHash.generateToken.mock.invocationCallOrder[0],
      );
      expect(otpHash.generateToken.mock.invocationCallOrder[0]).toBeLessThan(
        otpToken.create.mock.invocationCallOrder[0],
      );
    });

    it('유저가 없으면 otpToken.create/notify를 호출하지 않는다', async () => {
      userWriteRepo.findByContact.mockResolvedValue(undefined);

      await handler.requestPasswordReset('tenant-1', { email: 'x@x.com' } as any);

      expect(otpToken.create).not.toHaveBeenCalled();
      expect(notification.notify).not.toHaveBeenCalled();
    });

    it('email/phone 모두 없으면 BadRequestException을 던진다', async () => {
      await expect(
        handler.requestPasswordReset('tenant-1', {} as any),
      ).rejects.toThrow();
    });
  });

  describe('resetPassword', () => {
    it('otpHash.hash → findValidByTokenHash → findById → hash → save → consume 순서로 호출된다', async () => {
      await handler.resetPassword('tenant-1', 'user-1', {
        token: 'plain-token',
        newPassword: 'new-password',
      } as any);

      expect(otpHash.hash).toHaveBeenCalledTimes(1);
      expect(otpToken.findValidByTokenHash).toHaveBeenCalledTimes(1);
      expect(userWriteRepo.findById).toHaveBeenCalledTimes(1);
      expect(passwordHash.hash).toHaveBeenCalledTimes(1);
      expect(userWriteRepo.save).toHaveBeenCalledTimes(1);
      expect(otpToken.consume).toHaveBeenCalledTimes(1);

      expect(otpHash.hash.mock.invocationCallOrder[0]).toBeLessThan(
        otpToken.findValidByTokenHash.mock.invocationCallOrder[0],
      );
      expect(otpToken.findValidByTokenHash.mock.invocationCallOrder[0]).toBeLessThan(
        userWriteRepo.findById.mock.invocationCallOrder[0],
      );
      expect(userWriteRepo.findById.mock.invocationCallOrder[0]).toBeLessThan(
        passwordHash.hash.mock.invocationCallOrder[0],
      );
      expect(passwordHash.hash.mock.invocationCallOrder[0]).toBeLessThan(
        userWriteRepo.save.mock.invocationCallOrder[0],
      );
      expect(userWriteRepo.save.mock.invocationCallOrder[0]).toBeLessThan(
        otpToken.consume.mock.invocationCallOrder[0],
      );
    });

    it('토큰이 유효하지 않으면 consume/save를 호출하지 않는다', async () => {
      otpToken.findValidByTokenHash.mockResolvedValue(undefined);

      await expect(
        handler.resetPassword('tenant-1', 'user-1', {
          token: 'plain-token',
          newPassword: 'new-password',
        } as any),
      ).rejects.toThrow();

      expect(otpToken.consume).not.toHaveBeenCalled();
      expect(userWriteRepo.save).not.toHaveBeenCalled();
    });

    it('유저가 없으면 save/consume을 호출하지 않는다', async () => {
      userWriteRepo.findById.mockResolvedValue(undefined);

      await expect(
        handler.resetPassword('tenant-1', 'user-1', {
          token: 'plain-token',
          newPassword: 'new-password',
        } as any),
      ).rejects.toThrow();

      expect(userWriteRepo.save).not.toHaveBeenCalled();
      expect(otpToken.consume).not.toHaveBeenCalled();
    });
  });
});
