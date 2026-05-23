import { AuthCommandHandler } from '@application/commands/handlers/auth-command.handler';
import type { UserWriteRepositoryPort } from '@application/commands/ports/user-write-repository.port';
import type {
  PasswordHashPort,
  HashResult,
  HashPolicy,
} from '@application/ports/password-hash.port';
import type { OtpHashPort } from '@application/ports/otp-hash.port';
import type {
  OtpTokenPort,
  OtpTokenRecord,
} from '@application/ports/otp-token.port';
import type { NotificationPort } from '@application/ports/notification.port';
import type { MfaVerificationPort } from '@application/ports/mfa-verification.port';
import type { ConfigService } from '@nestjs/config';
import type { ConsentRepository } from '@domain/repositories/consent.repository';
import type { UserIdentityRepository } from '@domain/repositories/user-identity.repository';
import { UserModel } from '@domain/models/user';
import { UserCredentialModel } from '@domain/models/user-credential';
import { ConsentModel } from '@domain/models/consent';
import { UserIdentityModel } from '@domain/models/user-identity';

function makeActiveUser(
  overrides?: Partial<Parameters<typeof UserModel.of>[0]>,
): UserModel {
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
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    save: jest.fn().mockResolvedValue(undefined),
    findCredentialsByType: jest.fn().mockResolvedValue([]),
    createCredential: jest.fn().mockResolvedValue(undefined),
    saveCredential: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockConsentRepo(): jest.Mocked<ConsentRepository> {
  return {
    findByTenantUserClient: jest.fn().mockResolvedValue(null),
    listAllByUser: jest.fn().mockResolvedValue([]),
    listByUser: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    save: jest.fn().mockResolvedValue(null as any),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

function makeIdentity(
  overrides?: Partial<ConstructorParameters<typeof UserIdentityModel>[0]>,
  id = 'identity-1',
): UserIdentityModel {
  return new UserIdentityModel(
    {
      tenantId: 'tenant-1',
      userId: 'user-1',
      provider: 'google',
      providerSub: 'google-sub-1',
      email: 'john@example.com',
      profileJson: null,
      linkedAt: new Date('2025-01-01T00:00:00.000Z'),
      ...overrides,
    },
    id,
  );
}

function createMockUserIdentityRepo(): jest.Mocked<UserIdentityRepository> {
  const identity = makeIdentity();
  return {
    findByProviderSub: jest.fn().mockResolvedValue(null),
    findByIdForUser: jest.fn().mockResolvedValue(identity),
    listByUser: jest.fn().mockResolvedValue([identity]),
    save: jest.fn().mockResolvedValue(identity),
    delete: jest.fn().mockResolvedValue(undefined),
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
    defaultPolicy: jest.fn().mockReturnValue({
      alg: 'argon2id',
      params: {},
      version: 1,
    } as HashPolicy),
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

function makeOtpRecord(overrides?: Partial<OtpTokenRecord>): OtpTokenRecord {
  return {
    id: 'token-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    purpose: 'PASSWORD_RESET',
    requestId: 'request-1',
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
    ...overrides,
  };
}

function createMockNotification(): jest.Mocked<NotificationPort> {
  return {
    notify: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockMfaVerification(): jest.Mocked<MfaVerificationPort> {
  return {
    generateTotpSecret: jest.fn().mockReturnValue('JBSWY3DPEHPK3PXP'),
    buildTotpUri: jest.fn().mockReturnValue('otpauth://totp/Auth%3Ajohn'),
    verifyTotp: jest.fn().mockReturnValue(true),
    generateWebAuthnAuthOptions: jest.fn().mockResolvedValue({}),
    verifyWebAuthn: jest.fn().mockResolvedValue({
      verified: true,
      newCounter: 1,
    }),
    verifyRecoveryCode: jest.fn().mockResolvedValue(true),
  };
}

describe('AuthCommandHandler', () => {
  let handler: AuthCommandHandler;
  let userWriteRepo: jest.Mocked<UserWriteRepositoryPort>;
  let passwordHash: jest.Mocked<PasswordHashPort>;
  let otpHash: jest.Mocked<OtpHashPort>;
  let otpToken: jest.Mocked<OtpTokenPort>;
  let notification: jest.Mocked<NotificationPort>;
  let mfaVerification: jest.Mocked<MfaVerificationPort>;
  let configService: jest.Mocked<ConfigService>;
  let consentRepo: jest.Mocked<ConsentRepository>;
  let userIdentityRepo: jest.Mocked<UserIdentityRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    userWriteRepo = createMockUserWriteRepo();
    passwordHash = createMockPasswordHash();
    otpHash = createMockOtpHash();
    otpToken = createMockOtpToken();
    notification = createMockNotification();
    mfaVerification = createMockMfaVerification();
    consentRepo = createMockConsentRepo();
    userIdentityRepo = createMockUserIdentityRepo();
    configService = {
      get: jest.fn().mockReturnValue(undefined),
      getOrThrow: jest.fn().mockReturnValue('600'),
    } as any;

    handler = new AuthCommandHandler(
      userWriteRepo,
      passwordHash,
      otpHash,
      otpToken,
      notification,
      mfaVerification,
      configService,
      consentRepo,
      userIdentityRepo,
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

    it('tenant가 다르면 TenantMismatch를 던지고 verify/save를 호출하지 않는다', async () => {
      userWriteRepo.findById.mockResolvedValue(
        makeActiveUser({ tenantId: 'other-tenant' }),
      );

      await expect(
        handler.withdraw('tenant-1', 'user-1', { password: 'pw' } as any),
      ).rejects.toThrow('TenantMismatch');

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

    it('tenant가 다르면 TenantMismatch를 던지고 verify/hash/save를 호출하지 않는다', async () => {
      userWriteRepo.findById.mockResolvedValue(
        makeActiveUser({ tenantId: 'other-tenant' }),
      );

      await expect(
        handler.changePassword('tenant-1', 'user-1', {
          currentPassword: 'old',
          newPassword: 'new',
        } as any),
      ).rejects.toThrow('TenantMismatch');

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

      expect(
        userWriteRepo.findByContact.mock.invocationCallOrder[0],
      ).toBeLessThan(otpHash.generateToken.mock.invocationCallOrder[0]);
      expect(otpHash.generateToken.mock.invocationCallOrder[0]).toBeLessThan(
        otpToken.create.mock.invocationCallOrder[0],
      );
    });

    it('유저가 없으면 otpToken.create/notify를 호출하지 않는다', async () => {
      userWriteRepo.findByContact.mockResolvedValue(undefined);

      await handler.requestPasswordReset('tenant-1', {
        email: 'x@x.com',
      } as any);

      expect(otpToken.create).not.toHaveBeenCalled();
      expect(notification.notify).not.toHaveBeenCalled();
    });

    it('email/phone 모두 없으면 BadRequestException을 던진다', async () => {
      await expect(
        handler.requestPasswordReset('tenant-1', {} as any),
      ).rejects.toThrow();
    });

    it('이메일만 있는 유저면 email 채널로 알림을 보낸다', async () => {
      userWriteRepo.findByContact.mockResolvedValue(
        makeActiveUser({ email: 'john@example.com', phone: null }),
      );

      await handler.requestPasswordReset('tenant-1', {
        email: 'john@example.com',
      } as any);

      expect(notification.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          userId: 'user-1',
          channels: ['email'],
          to: {
            email: 'john@example.com',
            phone: undefined,
          },
          template: 'auth.password_reset',
          data: expect.objectContaining({
            token: 'plain-token',
            purpose: 'PASSWORD_RESET',
          }),
        }),
      );
    });

    it('전화번호만 있는 유저면 sms 채널로 알림을 보낸다', async () => {
      userWriteRepo.findByContact.mockResolvedValue(
        makeActiveUser({ email: null, phone: '010-1234-5678' }),
      );

      await handler.requestPasswordReset('tenant-1', {
        phone: '010-1234-5678',
      } as any);

      expect(notification.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          userId: 'user-1',
          channels: ['sms'],
          to: {
            email: undefined,
            phone: '010-1234-5678',
          },
          template: 'auth.password_reset',
          data: expect.objectContaining({
            token: 'plain-token',
            purpose: 'PASSWORD_RESET',
          }),
        }),
      );
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
      expect(
        otpToken.findValidByTokenHash.mock.invocationCallOrder[0],
      ).toBeLessThan(userWriteRepo.findById.mock.invocationCallOrder[0]);
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

    it('유저 tenant가 다르면 save/consume을 호출하지 않는다', async () => {
      userWriteRepo.findById.mockResolvedValue(
        makeActiveUser({ tenantId: 'other-tenant' }),
      );

      await expect(
        handler.resetPassword('tenant-1', 'user-1', {
          token: 'plain-token',
          newPassword: 'new-password',
        } as any),
      ).rejects.toThrow('TenantMismatch');

      expect(userWriteRepo.save).not.toHaveBeenCalled();
      expect(otpToken.consume).not.toHaveBeenCalled();
    });
  });

  describe('email verification', () => {
    it('requestEmailVerification은 EMAIL_VERIFICATION 토큰을 만들고 email 알림을 보낸다', async () => {
      userWriteRepo.findById.mockResolvedValue(
        makeActiveUser({
          email: 'john@example.com',
          emailVerified: false,
        }),
      );

      await handler.requestEmailVerification('tenant-1', 'user-1');

      expect(otpHash.generateToken).toHaveBeenCalledTimes(1);
      expect(otpHash.hash).toHaveBeenCalledWith('john@example.com:plain-token');
      expect(otpToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          userId: 'user-1',
          purpose: 'EMAIL_VERIFICATION',
          tokenHash: 'hashed-token',
        }),
      );
      expect(notification.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          userId: 'user-1',
          channels: ['email'],
          to: {
            email: 'john@example.com',
            phone: undefined,
          },
          template: 'auth.email_verification',
          data: expect.objectContaining({
            token: 'plain-token',
            purpose: 'EMAIL_VERIFICATION',
          }),
        }),
      );
    });

    it('이미 email 인증이 끝났으면 토큰과 알림을 만들지 않는다', async () => {
      userWriteRepo.findById.mockResolvedValue(
        makeActiveUser({
          email: 'john@example.com',
          emailVerified: true,
        }),
      );

      await handler.requestEmailVerification('tenant-1', 'user-1');

      expect(otpToken.create).not.toHaveBeenCalled();
      expect(notification.notify).not.toHaveBeenCalled();
    });

    it('email이 없으면 BadRequestException을 던지고 토큰을 만들지 않는다', async () => {
      userWriteRepo.findById.mockResolvedValue(makeActiveUser({ email: null }));

      await expect(
        handler.requestEmailVerification('tenant-1', 'user-1'),
      ).rejects.toThrow('email is required');

      expect(otpToken.create).not.toHaveBeenCalled();
      expect(notification.notify).not.toHaveBeenCalled();
    });

    it('verifyEmail은 contact-bound token을 검증하고 user를 저장한 뒤 토큰을 consume한다', async () => {
      const user = makeActiveUser({
        email: 'john@example.com',
        emailVerified: false,
      });
      userWriteRepo.findById.mockResolvedValue(user);
      otpToken.findValidByTokenHash.mockResolvedValue(
        makeOtpRecord({ purpose: 'EMAIL_VERIFICATION' }),
      );

      await handler.verifyEmail('tenant-1', 'user-1', {
        token: 'plain-token',
      });

      expect(otpHash.hash).toHaveBeenCalledWith('john@example.com:plain-token');
      expect(otpToken.findValidByTokenHash).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        purpose: 'EMAIL_VERIFICATION',
        tokenHash: 'hashed-token',
      });
      expect(user.emailVerified).toBe(true);
      expect(userWriteRepo.save).toHaveBeenCalledWith(user);
      expect(otpToken.consume).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          purpose: 'EMAIL_VERIFICATION',
          otpTokenId: 'token-1',
        }),
      );
    });

    it('verifyEmail에서 유효한 토큰이 없으면 저장/consume하지 않는다', async () => {
      userWriteRepo.findById.mockResolvedValue(
        makeActiveUser({ email: 'john@example.com' }),
      );
      otpToken.findValidByTokenHash.mockResolvedValue(undefined);

      await expect(
        handler.verifyEmail('tenant-1', 'user-1', {
          token: 'bad-token',
        }),
      ).rejects.toThrow('InvalidToken');

      expect(userWriteRepo.save).not.toHaveBeenCalled();
      expect(otpToken.consume).not.toHaveBeenCalled();
    });

    it('verifyEmail에서 토큰 user가 다르면 저장/consume하지 않는다', async () => {
      userWriteRepo.findById.mockResolvedValue(
        makeActiveUser({ email: 'john@example.com' }),
      );
      otpToken.findValidByTokenHash.mockResolvedValue(
        makeOtpRecord({
          purpose: 'EMAIL_VERIFICATION',
          userId: 'other-user',
        }),
      );

      await expect(
        handler.verifyEmail('tenant-1', 'user-1', {
          token: 'plain-token',
        }),
      ).rejects.toThrow('InvalidToken');

      expect(userWriteRepo.save).not.toHaveBeenCalled();
      expect(otpToken.consume).not.toHaveBeenCalled();
    });
  });

  describe('phone verification', () => {
    it('requestPhoneVerification은 PHONE_VERIFICATION 토큰을 만들고 sms 알림을 보낸다', async () => {
      userWriteRepo.findById.mockResolvedValue(
        makeActiveUser({
          phone: '+821012345678',
          phoneVerified: false,
        }),
      );

      await handler.requestPhoneVerification('tenant-1', 'user-1');

      expect(otpHash.generateToken).toHaveBeenCalledTimes(1);
      expect(otpHash.hash).toHaveBeenCalledWith('+821012345678:plain-token');
      expect(otpToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          userId: 'user-1',
          purpose: 'PHONE_VERIFICATION',
          tokenHash: 'hashed-token',
        }),
      );
      expect(notification.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          userId: 'user-1',
          channels: ['sms'],
          to: {
            email: undefined,
            phone: '+821012345678',
          },
          template: 'auth.phone_verification',
          data: expect.objectContaining({
            token: 'plain-token',
            purpose: 'PHONE_VERIFICATION',
          }),
        }),
      );
    });

    it('이미 phone 인증이 끝났으면 토큰과 알림을 만들지 않는다', async () => {
      userWriteRepo.findById.mockResolvedValue(
        makeActiveUser({
          phone: '+821012345678',
          phoneVerified: true,
        }),
      );

      await handler.requestPhoneVerification('tenant-1', 'user-1');

      expect(otpToken.create).not.toHaveBeenCalled();
      expect(notification.notify).not.toHaveBeenCalled();
    });

    it('phone이 없으면 BadRequestException을 던지고 토큰을 만들지 않는다', async () => {
      userWriteRepo.findById.mockResolvedValue(makeActiveUser({ phone: null }));

      await expect(
        handler.requestPhoneVerification('tenant-1', 'user-1'),
      ).rejects.toThrow('phone is required');

      expect(otpToken.create).not.toHaveBeenCalled();
      expect(notification.notify).not.toHaveBeenCalled();
    });

    it('verifyPhone은 contact-bound token을 검증하고 user를 저장한 뒤 토큰을 consume한다', async () => {
      const user = makeActiveUser({
        phone: '+821012345678',
        phoneVerified: false,
      });
      userWriteRepo.findById.mockResolvedValue(user);
      otpToken.findValidByTokenHash.mockResolvedValue(
        makeOtpRecord({ purpose: 'PHONE_VERIFICATION' }),
      );

      await handler.verifyPhone('tenant-1', 'user-1', {
        token: 'plain-token',
      });

      expect(otpHash.hash).toHaveBeenCalledWith('+821012345678:plain-token');
      expect(otpToken.findValidByTokenHash).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        purpose: 'PHONE_VERIFICATION',
        tokenHash: 'hashed-token',
      });
      expect(user.phoneVerified).toBe(true);
      expect(userWriteRepo.save).toHaveBeenCalledWith(user);
      expect(otpToken.consume).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          purpose: 'PHONE_VERIFICATION',
          otpTokenId: 'token-1',
        }),
      );
    });

    it('verifyPhone에서 유효한 토큰이 없으면 저장/consume하지 않는다', async () => {
      userWriteRepo.findById.mockResolvedValue(
        makeActiveUser({ phone: '+821012345678' }),
      );
      otpToken.findValidByTokenHash.mockResolvedValue(undefined);

      await expect(
        handler.verifyPhone('tenant-1', 'user-1', {
          token: 'bad-token',
        }),
      ).rejects.toThrow('InvalidToken');

      expect(userWriteRepo.save).not.toHaveBeenCalled();
      expect(otpToken.consume).not.toHaveBeenCalled();
    });

    it('verifyPhone에서 토큰 user가 다르면 저장/consume하지 않는다', async () => {
      userWriteRepo.findById.mockResolvedValue(
        makeActiveUser({ phone: '+821012345678' }),
      );
      otpToken.findValidByTokenHash.mockResolvedValue(
        makeOtpRecord({
          purpose: 'PHONE_VERIFICATION',
          userId: 'other-user',
        }),
      );

      await expect(
        handler.verifyPhone('tenant-1', 'user-1', {
          token: 'plain-token',
        }),
      ).rejects.toThrow('InvalidToken');

      expect(userWriteRepo.save).not.toHaveBeenCalled();
      expect(otpToken.consume).not.toHaveBeenCalled();
    });
  });

  describe('TOTP MFA enrollment', () => {
    it('beginTotpEnrollment은 disabled TOTP credential을 만들고 secret/otpauthUrl을 반환한다', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'OTP_TOTP_ISSUER' ? 'ExampleAuth' : undefined,
      );
      userWriteRepo.findById.mockResolvedValue(
        makeActiveUser({
          username: 'john',
          email: 'john@example.com',
        }),
      );

      const result = await handler.beginTotpEnrollment('tenant-1', 'user-1');

      expect(mfaVerification.generateTotpSecret).toHaveBeenCalledTimes(1);
      expect(userWriteRepo.createCredential).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          type: 'totp',
          secretHash: 'JBSWY3DPEHPK3PXP',
          hashAlg: 'totp-sha1',
          enabled: false,
        }),
      );
      expect(mfaVerification.buildTotpUri).toHaveBeenCalledWith({
        issuer: 'ExampleAuth',
        accountName: 'john@example.com',
        secret: 'JBSWY3DPEHPK3PXP',
      });
      expect(result).toEqual({
        secret: 'JBSWY3DPEHPK3PXP',
        otpauthUrl: 'otpauth://totp/Auth%3Ajohn',
      });
    });

    it('beginTotpEnrollment은 tenant가 다르면 credential을 만들지 않는다', async () => {
      userWriteRepo.findById.mockResolvedValue(
        makeActiveUser({ tenantId: 'other-tenant' }),
      );

      await expect(
        handler.beginTotpEnrollment('tenant-1', 'user-1'),
      ).rejects.toThrow('TenantMismatch');

      expect(userWriteRepo.createCredential).not.toHaveBeenCalled();
    });

    it('confirmTotpEnrollment은 pending TOTP를 활성화하고 recovery code를 발급한다', async () => {
      const pending = UserCredentialModel.of(
        {
          type: 'totp',
          secretHash: 'JBSWY3DPEHPK3PXP',
          hashAlg: 'totp-sha1',
          hashParams: { pendingEnrollment: true },
          hashVersion: 1,
          enabled: false,
        },
        'pending-totp',
      );
      const active = UserCredentialModel.of(
        {
          type: 'totp',
          secretHash: 'OLDSECRET',
          hashAlg: 'totp-sha1',
          enabled: true,
        },
        'active-totp',
      );
      userWriteRepo.findCredentialsByType
        .mockResolvedValueOnce([pending])
        .mockResolvedValueOnce([active]);
      otpHash.generateToken.mockReturnValue('recovery-code');

      const result = await handler.confirmTotpEnrollment('tenant-1', 'user-1', {
        code: '123456',
      });

      expect(mfaVerification.verifyTotp).toHaveBeenCalledWith(
        'JBSWY3DPEHPK3PXP',
        '123456',
      );
      expect(active.enabled).toBe(false);
      expect(pending.enabled).toBe(true);
      expect(pending.hashParams).toEqual(
        expect.objectContaining({ pendingEnrollment: false }),
      );
      expect(userWriteRepo.saveCredential).toHaveBeenCalledWith(active);
      expect(userWriteRepo.saveCredential).toHaveBeenCalledWith(pending);
      expect(userWriteRepo.createCredential).toHaveBeenCalledTimes(10);
      expect(result.recoveryCodes).toHaveLength(10);
      expect(result.recoveryCodes).toEqual(
        Array.from({ length: 10 }, () => 'recovery-code'),
      );
    });

    it('confirmTotpEnrollment은 pending credential이 없으면 실패한다', async () => {
      userWriteRepo.findCredentialsByType.mockResolvedValueOnce([]);

      await expect(
        handler.confirmTotpEnrollment('tenant-1', 'user-1', {
          code: '123456',
        }),
      ).rejects.toThrow('TotpEnrollmentNotFound');

      expect(userWriteRepo.saveCredential).not.toHaveBeenCalled();
      expect(userWriteRepo.createCredential).not.toHaveBeenCalled();
    });

    it('confirmTotpEnrollment은 disabled지만 enrollment pending이 아니면 실패한다', async () => {
      const disabledTotp = UserCredentialModel.of(
        {
          type: 'totp',
          secretHash: 'JBSWY3DPEHPK3PXP',
          hashAlg: 'totp-sha1',
          hashParams: { pendingEnrollment: false },
          enabled: false,
        },
        'disabled-totp',
      );
      userWriteRepo.findCredentialsByType.mockResolvedValueOnce([disabledTotp]);

      await expect(
        handler.confirmTotpEnrollment('tenant-1', 'user-1', {
          code: '123456',
        }),
      ).rejects.toThrow('TotpEnrollmentNotFound');

      expect(userWriteRepo.saveCredential).not.toHaveBeenCalled();
      expect(userWriteRepo.createCredential).not.toHaveBeenCalled();
    });

    it('confirmTotpEnrollment은 잘못된 코드면 credential을 변경하지 않는다', async () => {
      const pending = UserCredentialModel.of(
        {
          type: 'totp',
          secretHash: 'JBSWY3DPEHPK3PXP',
          hashAlg: 'totp-sha1',
          hashParams: { pendingEnrollment: true },
          enabled: false,
        },
        'pending-totp',
      );
      userWriteRepo.findCredentialsByType.mockResolvedValueOnce([pending]);
      mfaVerification.verifyTotp.mockReturnValue(false);

      await expect(
        handler.confirmTotpEnrollment('tenant-1', 'user-1', {
          code: '000000',
        }),
      ).rejects.toThrow('InvalidTotpCode');

      expect(userWriteRepo.saveCredential).not.toHaveBeenCalled();
      expect(userWriteRepo.createCredential).not.toHaveBeenCalled();
    });

    it('disableTotp은 활성 TOTP와 recovery code credential을 비활성화한다', async () => {
      const totp = UserCredentialModel.of(
        {
          type: 'totp',
          secretHash: 'JBSWY3DPEHPK3PXP',
          hashAlg: 'totp-sha1',
          enabled: true,
        },
        'totp-1',
      );
      const recoveryCode = UserCredentialModel.of(
        {
          type: 'recovery_code',
          secretHash: 'hashed-code',
          hashAlg: 'argon2id',
          enabled: true,
        },
        'recovery-1',
      );
      userWriteRepo.findCredentialsByType.mockResolvedValueOnce([
        totp,
        recoveryCode,
      ]);

      await handler.disableTotp('tenant-1', 'user-1');

      expect(userWriteRepo.findCredentialsByType).toHaveBeenCalledWith(
        'user-1',
        ['totp', 'recovery_code'],
      );
      expect(totp.enabled).toBe(false);
      expect(recoveryCode.enabled).toBe(false);
      expect(userWriteRepo.saveCredential).toHaveBeenCalledWith(totp);
      expect(userWriteRepo.saveCredential).toHaveBeenCalledWith(recoveryCode);
    });
  });

  describe('unlinkIdentity', () => {
    it('identity가 현재 사용자에 속하면 연결을 해제한다', async () => {
      const identity = makeIdentity({}, 'identity-1');
      userIdentityRepo.findByIdForUser.mockResolvedValue(identity);
      userIdentityRepo.listByUser.mockResolvedValue([identity]);

      await handler.unlinkIdentity('tenant-1', 'user-1', 'identity-1');

      expect(userIdentityRepo.findByIdForUser).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        'identity-1',
      );
      expect(userIdentityRepo.delete).toHaveBeenCalledWith('identity-1');
    });

    it('identity가 없으면 delete를 호출하지 않는다', async () => {
      userIdentityRepo.findByIdForUser.mockResolvedValue(null);

      await expect(
        handler.unlinkIdentity('tenant-1', 'user-1', 'missing'),
      ).rejects.toThrow('IdentityLinkNotFound');

      expect(userIdentityRepo.delete).not.toHaveBeenCalled();
    });

    it('tenant가 다르면 identity 조회 없이 실패한다', async () => {
      userWriteRepo.findById.mockResolvedValue(
        makeActiveUser({ tenantId: 'other-tenant' }),
      );

      await expect(
        handler.unlinkIdentity('tenant-1', 'user-1', 'identity-1'),
      ).rejects.toThrow('TenantMismatch');

      expect(userIdentityRepo.findByIdForUser).not.toHaveBeenCalled();
      expect(userIdentityRepo.delete).not.toHaveBeenCalled();
    });

    it('마지막 로그인 수단이면 연결을 해제하지 않는다', async () => {
      const identity = makeIdentity({}, 'identity-1');
      userWriteRepo.findById.mockResolvedValue(
        makeActiveUser({ passwordCredential: undefined }),
      );
      userIdentityRepo.findByIdForUser.mockResolvedValue(identity);
      userIdentityRepo.listByUser.mockResolvedValue([identity]);

      await expect(
        handler.unlinkIdentity('tenant-1', 'user-1', 'identity-1'),
      ).rejects.toThrow('LastLoginMethodCannotBeUnlinked');

      expect(userIdentityRepo.delete).not.toHaveBeenCalled();
    });

    it('비밀번호가 없어도 다른 IdP 연결이 남아 있으면 해제할 수 있다', async () => {
      const identity = makeIdentity({}, 'identity-1');
      const otherIdentity = makeIdentity(
        { provider: 'github', providerSub: 'github-sub-1' },
        'identity-2',
      );
      userWriteRepo.findById.mockResolvedValue(
        makeActiveUser({ passwordCredential: undefined }),
      );
      userIdentityRepo.findByIdForUser.mockResolvedValue(identity);
      userIdentityRepo.listByUser.mockResolvedValue([identity, otherIdentity]);

      await handler.unlinkIdentity('tenant-1', 'user-1', 'identity-1');

      expect(userIdentityRepo.delete).toHaveBeenCalledWith('identity-1');
    });
  });

  describe('updateProfile', () => {
    it('유저가 없으면 UserNotFound를 던진다', async () => {
      userWriteRepo.findById.mockResolvedValue(undefined);

      await expect(
        handler.updateProfile('tenant-1', 'user-1', {} as any),
      ).rejects.toThrow('UserNotFound');
    });

    it('tenant 불일치 시 TenantMismatch를 던진다', async () => {
      userWriteRepo.findById.mockResolvedValue(
        makeActiveUser({ tenantId: 'other' }),
      );

      await expect(
        handler.updateProfile('tenant-1', 'user-1', {} as any),
      ).rejects.toThrow('TenantMismatch');
    });

    it('WITHDRAWN 유저는 UserAlreadyWithdrawn을 던진다', async () => {
      userWriteRepo.findById.mockResolvedValue(
        makeActiveUser({ status: 'WITHDRAWN' }),
      );

      await expect(
        handler.updateProfile('tenant-1', 'user-1', {} as any),
      ).rejects.toThrow('UserAlreadyWithdrawn');
    });

    it('성공 시 email/phone을 변경하고 save를 호출한다', async () => {
      const user = makeActiveUser({ email: null, phone: null });
      userWriteRepo.findById.mockResolvedValue(user);

      await handler.updateProfile('tenant-1', 'user-1', {
        email: 'new@ex.com',
        phone: '010-1234-5678',
      } as any);

      expect(user.email).toBe('new@ex.com');
      expect(user.phone).toBe('010-1234-5678');
      expect(userWriteRepo.save).toHaveBeenCalledWith(user);
    });

    it('email/phone에 null을 주면 프로필 연락처를 비운다', async () => {
      const user = makeActiveUser({
        email: 'before@example.com',
        phone: '010-0000-0000',
      });
      userWriteRepo.findById.mockResolvedValue(user);

      await handler.updateProfile('tenant-1', 'user-1', {
        email: null,
        phone: null,
      } as any);

      expect(user.email).toBeNull();
      expect(user.phone).toBeNull();
      expect(userWriteRepo.save).toHaveBeenCalledWith(user);
    });
  });

  describe('revokeConsent', () => {
    it('consent가 없으면 ConsentNotFound를 던진다', async () => {
      consentRepo.findByTenantUserClient.mockResolvedValue(null);

      await expect(
        handler.revokeConsent('tenant-1', 'user-1', 'client-1'),
      ).rejects.toThrow('ConsentNotFound');
    });

    it('이미 revoke된 consent는 save를 호출하지 않는다', async () => {
      const consent = new ConsentModel(
        {
          tenantId: 'tenant-1',
          userId: 'user-1',
          clientRefId: 'client-1',
          grantedScopes: 'openid',
          grantedAt: new Date(),
          revokedAt: new Date(),
        },
        'consent-1',
      );
      consentRepo.findByTenantUserClient.mockResolvedValue(consent);

      await handler.revokeConsent('tenant-1', 'user-1', 'client-1');

      expect(consentRepo.save).not.toHaveBeenCalled();
    });

    it('성공 시 consent.revoke() + save를 호출한다', async () => {
      const consent = new ConsentModel(
        {
          tenantId: 'tenant-1',
          userId: 'user-1',
          clientRefId: 'client-1',
          grantedScopes: 'openid',
          grantedAt: new Date(),
        },
        'consent-1',
      );
      consentRepo.findByTenantUserClient.mockResolvedValue(consent);

      await handler.revokeConsent('tenant-1', 'user-1', 'client-1');

      expect(consent.isRevoked).toBe(true);
      expect(consentRepo.save).toHaveBeenCalledWith(consent);
    });
  });
});
