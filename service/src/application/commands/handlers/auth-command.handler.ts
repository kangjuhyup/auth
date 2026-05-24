import {
  WithdrawDto,
  ChangePasswordDto,
  PasswordResetRequestDto,
  PasswordResetDto,
  VerificationTokenDto,
  TotpEnrollmentResponse,
  TotpConfirmationDto,
  TotpConfirmationResponse,
  UpdateMfaPreferenceDto,
  UpdateProfileDto,
  SignupDto,
} from '@application/dto';
import { AuthCommandPort } from '../ports/auth-command.port';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ulid } from 'ulid';
import { UserModel } from '@domain/models/user';
import { UserCredentialModel } from '@domain/models/user-credential';
import { PasswordHashPort } from '@application/ports/password-hash.port';
import { OtpHashPort } from '@application/ports/otp-hash.port';
import { OtpTokenPort } from '@application/ports/otp-token.port';
import { NotificationPort } from '@application/ports/notification.port';
import { MfaVerificationPort } from '@application/ports/mfa-verification.port';
import { UserWriteRepositoryPort } from '../ports/user-write-repository.port';
import { ConsentRepository } from '@domain/repositories/consent.repository';
import { UserIdentityRepository } from '@domain/repositories/user-identity.repository';
import { EventRepository } from '@domain/repositories/event.repository';
import { EventModel } from '@domain/models/event';
import { orThrow } from '@domain/utils';

@Injectable()
export class AuthCommandHandler implements AuthCommandPort {
  private readonly logger = new Logger(AuthCommandHandler.name);

  constructor(
    private readonly userWriteRepo: UserWriteRepositoryPort,
    private readonly passwordHash: PasswordHashPort,
    private readonly otpHash: OtpHashPort,
    private readonly otpToken: OtpTokenPort,
    private readonly notification: NotificationPort,
    private readonly mfaVerification: MfaVerificationPort,
    private readonly configService: ConfigService,
    private readonly consentRepo: ConsentRepository,
    private readonly userIdentityRepo: UserIdentityRepository,
    private readonly eventRepo: EventRepository,
  ) {}

  async signup(tenantId: string, dto: SignupDto): Promise<{ userId: string }> {
    this.logger.log(`Signing up user in tenant ${tenantId}`);

    const userId = ulid();
    const passwordHashResult = await this.passwordHash.hash(dto.password);

    const credential = UserCredentialModel.password({
      secretHash: passwordHashResult.hash,
      hashAlg: passwordHashResult.alg,
      hashParams: passwordHashResult.params,
      hashVersion: passwordHashResult.version,
    });

    const user = UserModel.create({
      id: userId,
      tenantId,
      username: dto.username,
      email: dto.email,
      phone: dto.phone,
      passwordCredential: credential,
    });

    await this.userWriteRepo.save(user);

    return { userId };
  }

  async withdraw(
    tenantId: string,
    userId: string,
    dto: WithdrawDto,
  ): Promise<void> {
    this.logger.log(`Withdrawing user=${userId} tenant=${tenantId}`);

    const user = orThrow(
      await this.userWriteRepo.findById(userId),
      new Error('UserNotFound'),
    );
    if (user.tenantId !== tenantId) throw new Error('TenantMismatch');

    const credential = user.getPasswordCredential();
    const ok = await this.passwordHash.verify(
      credential.secretHash,
      dto.password,
      credential.hashAlg,
    );
    if (!ok) throw new Error('InvalidPassword');

    user.withdraw();
    await this.userWriteRepo.save(user);
  }

  async changePassword(
    tenantId: string,
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    this.logger.log(
      `Changing password for user ${userId} in tenant ${tenantId}`,
    );

    const user = orThrow(
      await this.userWriteRepo.findById(userId),
      new Error('UserNotFound'),
    );
    if (user.tenantId !== tenantId) throw new Error('TenantMismatch');

    const currentCred = user.getPasswordCredential();
    const ok = await this.passwordHash.verify(
      currentCred.secretHash,
      dto.currentPassword,
      currentCred.hashAlg,
    );
    if (!ok) throw new Error('InvalidPassword');

    const hashResult = await this.passwordHash.hash(dto.newPassword);
    const newCred = UserCredentialModel.password({
      secretHash: hashResult.hash,
      hashAlg: hashResult.alg,
      hashParams: hashResult.params,
      hashVersion: hashResult.version,
    });

    user.changePassword(newCred);
    await this.userWriteRepo.save(user);
  }

  async requestPasswordReset(
    tenantId: string,
    dto: PasswordResetRequestDto,
  ): Promise<void> {
    this.logger.log(`Requesting password reset for tenant ${tenantId}`);

    if (!dto.email && !dto.phone)
      throw new BadRequestException('required email or phone');

    const user = await this.userWriteRepo.findByContact(tenantId, {
      email: dto.email?.trim(),
      phone: dto.phone?.trim(),
    });

    // 사용자가 없어도 항상 성공처럼 종료 (보안상 존재 여부 노출 방지)
    if (!user) return;

    const requestId = ulid();
    const rawToken = this.otpHash.generateToken(32);
    const tokenHash = this.otpHash.hash(rawToken);

    const ttlSec = Number(
      this.configService.getOrThrow<string>('OTP_PASSWORD_RESET_TTL_SEC'),
    );
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + ttlSec * 1000);

    await this.otpToken.create({
      tenantId,
      userId: user.id,
      purpose: 'PASSWORD_RESET',
      requestId,
      tokenHash,
      issuedAt,
      expiresAt,
    });

    const channels = [
      ...(user.email ? (['email'] as const) : []),
      ...(user.phone ? (['sms'] as const) : []),
    ];

    if (channels.length > 0) {
      await this.notification.notify({
        correlationId: requestId,
        tenantId,
        userId: user.id,
        to: {
          email: user.email ?? undefined,
          phone: user.phone ?? undefined,
        },
        template: 'auth.password_reset',
        data: {
          token: rawToken,
          expiresAt: expiresAt.toISOString(),
          purpose: 'PASSWORD_RESET',
        },
        channels,
      });
    }
  }

  async resetPassword(
    tenantId: string,
    userId: string,
    dto: PasswordResetDto,
  ): Promise<void> {
    this.logger.log(`Resetting password for tenant ${tenantId}`);

    const plain = orThrow(dto.token?.trim(), new Error('InvalidToken'));

    const tokenHash = this.otpHash.hash(plain);

    const record = orThrow(
      await this.otpToken.findValidByTokenHash({
        tenantId,
        purpose: 'PASSWORD_RESET',
        tokenHash,
      }),
      new Error('InvalidToken'),
    );

    const user = orThrow(
      await this.userWriteRepo.findById(userId),
      new Error('UserNotFound'),
    );
    if (user.tenantId !== tenantId) throw new Error('TenantMismatch');

    const hashResult = await this.passwordHash.hash(dto.newPassword);
    const newCred = UserCredentialModel.password({
      secretHash: hashResult.hash,
      hashAlg: hashResult.alg,
      hashParams: hashResult.params,
      hashVersion: hashResult.version,
    });

    user.changePassword(newCred);
    await this.userWriteRepo.save(user);

    await this.otpToken.consume({
      tenantId,
      purpose: 'PASSWORD_RESET',
      otpTokenId: record.id,
      consumedAt: new Date(),
    });
  }

  async requestEmailVerification(
    tenantId: string,
    userId: string,
  ): Promise<void> {
    this.logger.log(`Requesting email verification for user=${userId}`);

    const user = this.assertActiveTenantUser(
      await this.userWriteRepo.findById(userId),
      tenantId,
    );
    if (!user.email) throw new BadRequestException('email is required');
    if (user.emailVerified) return;

    const rawToken = await this.createVerificationToken({
      tenantId,
      userId,
      purpose: 'EMAIL_VERIFICATION',
      contact: user.email,
      ttlSec: this.getTtlSec('OTP_EMAIL_VERIFICATION_TTL_SEC', 900),
    });

    await this.notification.notify({
      correlationId: ulid(),
      tenantId,
      userId: user.id,
      to: { email: user.email },
      template: 'auth.email_verification',
      data: {
        token: rawToken,
        purpose: 'EMAIL_VERIFICATION',
      },
      channels: ['email'],
    });
  }

  async verifyEmail(
    tenantId: string,
    userId: string,
    dto: VerificationTokenDto,
  ): Promise<void> {
    const user = this.assertActiveTenantUser(
      await this.userWriteRepo.findById(userId),
      tenantId,
    );
    if (!user.email) throw new BadRequestException('email is required');

    const tokenHash = this.hashVerificationToken({
      token: dto.token,
      contact: user.email,
    });
    const record = orThrow(
      await this.otpToken.findValidByTokenHash({
        tenantId,
        purpose: 'EMAIL_VERIFICATION',
        tokenHash,
      }),
      new Error('InvalidToken'),
    );
    if (record.userId !== userId) throw new Error('InvalidToken');

    user.verifyEmail();
    await this.userWriteRepo.save(user);
    await this.otpToken.consume({
      tenantId,
      purpose: 'EMAIL_VERIFICATION',
      otpTokenId: record.id,
      consumedAt: new Date(),
    });
    await this.recordAudit({
      tenantId,
      userId,
      category: 'USER',
      action: 'UPDATE',
      resourceType: 'user_contact',
      resourceId: userId,
      metadata: { contact: 'email', verified: true },
    });
  }

  async requestPhoneVerification(
    tenantId: string,
    userId: string,
  ): Promise<void> {
    this.logger.log(`Requesting phone verification for user=${userId}`);

    const user = this.assertActiveTenantUser(
      await this.userWriteRepo.findById(userId),
      tenantId,
    );
    if (!user.phone) throw new BadRequestException('phone is required');
    if (user.phoneVerified) return;

    const rawToken = await this.createVerificationToken({
      tenantId,
      userId,
      purpose: 'PHONE_VERIFICATION',
      contact: user.phone,
      ttlSec: this.getTtlSec('OTP_PHONE_VERIFICATION_TTL_SEC', 300),
    });

    await this.notification.notify({
      correlationId: ulid(),
      tenantId,
      userId: user.id,
      to: { phone: user.phone },
      template: 'auth.phone_verification',
      data: {
        token: rawToken,
        purpose: 'PHONE_VERIFICATION',
      },
      channels: ['sms'],
    });
  }

  async verifyPhone(
    tenantId: string,
    userId: string,
    dto: VerificationTokenDto,
  ): Promise<void> {
    const user = this.assertActiveTenantUser(
      await this.userWriteRepo.findById(userId),
      tenantId,
    );
    if (!user.phone) throw new BadRequestException('phone is required');

    const tokenHash = this.hashVerificationToken({
      token: dto.token,
      contact: user.phone,
    });
    const record = orThrow(
      await this.otpToken.findValidByTokenHash({
        tenantId,
        purpose: 'PHONE_VERIFICATION',
        tokenHash,
      }),
      new Error('InvalidToken'),
    );
    if (record.userId !== userId) throw new Error('InvalidToken');

    user.verifyPhone();
    await this.userWriteRepo.save(user);
    await this.otpToken.consume({
      tenantId,
      purpose: 'PHONE_VERIFICATION',
      otpTokenId: record.id,
      consumedAt: new Date(),
    });
    await this.recordAudit({
      tenantId,
      userId,
      category: 'USER',
      action: 'UPDATE',
      resourceType: 'user_contact',
      resourceId: userId,
      metadata: { contact: 'phone', verified: true },
    });
  }

  async beginTotpEnrollment(
    tenantId: string,
    userId: string,
  ): Promise<TotpEnrollmentResponse> {
    const user = this.assertActiveTenantUser(
      await this.userWriteRepo.findById(userId),
      tenantId,
    );

    const secret = this.mfaVerification.generateTotpSecret();
    const issuer = this.getStringConfig('OTP_TOTP_ISSUER', 'Auth');
    const accountName = user.email ?? user.username;
    const credential = UserCredentialModel.of({
      type: 'totp',
      secretHash: secret,
      hashAlg: 'totp-sha1',
      hashParams: {
        issuer,
        accountName,
        pendingEnrollment: true,
      },
      hashVersion: 1,
      enabled: false,
    });

    await this.userWriteRepo.createCredential(user.id, credential);

    return {
      secret,
      otpauthUrl: this.mfaVerification.buildTotpUri({
        issuer,
        accountName,
        secret,
      }),
    };
  }

  async confirmTotpEnrollment(
    tenantId: string,
    userId: string,
    dto: TotpConfirmationDto,
  ): Promise<TotpConfirmationResponse> {
    const user = this.assertActiveTenantUser(
      await this.userWriteRepo.findById(userId),
      tenantId,
    );

    const pendingCredentials = await this.userWriteRepo.findCredentialsByType(
      userId,
      ['totp'],
      { enabled: false },
    );
    const pending = pendingCredentials.find(
      (credential) => credential.hashParams?.pendingEnrollment === true,
    );
    if (!pending) throw new Error('TotpEnrollmentNotFound');

    const verified = this.mfaVerification.verifyTotp(
      pending.secretHash,
      dto.code,
    );
    if (!verified) {
      await this.recordAudit({
        tenantId,
        userId,
        category: 'SECURITY',
        severity: 'WARN',
        action: 'ACCESS_DENIED',
        resourceType: 'mfa',
        resourceId: 'totp',
        success: false,
        reason: 'InvalidTotpCode',
        metadata: { method: 'totp', phase: 'enrollment' },
      });
      throw new Error('InvalidTotpCode');
    }

    const activeCredentials = await this.userWriteRepo.findCredentialsByType(
      userId,
      ['totp'],
    );
    for (const credential of activeCredentials) {
      credential.disable();
      await this.userWriteRepo.saveCredential(credential);
    }

    pending.enable();
    pending.updateHashParams({
      ...(pending.hashParams ?? {}),
      pendingEnrollment: false,
      enrolledAt: new Date().toISOString(),
    });
    await this.userWriteRepo.saveCredential(pending);

    const recoveryCodes = await this.createRecoveryCodes(userId);
    user.changeMfaEnabled(true);
    await this.userWriteRepo.save(user);

    await this.recordAudit({
      tenantId,
      userId,
      category: 'SECURITY',
      action: 'UPDATE',
      resourceType: 'mfa',
      resourceId: 'totp',
      metadata: {
        method: 'totp',
        enabled: true,
        recoveryCodeCount: recoveryCodes.length,
      },
    });
    return { recoveryCodes };
  }

  async disableTotp(tenantId: string, userId: string): Promise<void> {
    const user = this.assertActiveTenantUser(
      await this.userWriteRepo.findById(userId),
      tenantId,
    );

    const credentials = await this.userWriteRepo.findCredentialsByType(userId, [
      'totp',
      'recovery_code',
    ]);
    for (const credential of credentials) {
      credential.disable();
      await this.userWriteRepo.saveCredential(credential);
    }
    user.changeMfaEnabled(false);
    await this.userWriteRepo.save(user);
    await this.recordAudit({
      tenantId,
      userId,
      category: 'SECURITY',
      action: 'UPDATE',
      resourceType: 'mfa',
      resourceId: 'totp',
      metadata: { method: 'totp', enabled: false },
    });
  }

  async updateMfaPreference(
    tenantId: string,
    userId: string,
    dto: UpdateMfaPreferenceDto,
  ): Promise<void> {
    const user = this.assertActiveTenantUser(
      await this.userWriteRepo.findById(userId),
      tenantId,
    );

    if (dto.enabled) {
      const credentials = await this.userWriteRepo.findCredentialsByType(
        userId,
        ['totp', 'webauthn', 'recovery_code'],
      );
      if (credentials.length === 0) {
        throw new BadRequestException('MFA credential is required');
      }
    }

    user.changeMfaEnabled(dto.enabled);
    await this.userWriteRepo.save(user);
    await this.recordAudit({
      tenantId,
      userId,
      category: 'SECURITY',
      action: 'UPDATE',
      resourceType: 'mfa',
      resourceId: 'preference',
      metadata: { enabled: dto.enabled },
    });
  }

  async unlinkIdentity(
    tenantId: string,
    userId: string,
    identityId: string,
  ): Promise<void> {
    const user = this.assertActiveTenantUser(
      await this.userWriteRepo.findById(userId),
      tenantId,
    );
    const identity = orThrow(
      await this.userIdentityRepo.findByIdForUser(tenantId, userId, identityId),
      new Error('IdentityLinkNotFound'),
    );
    const links = await this.userIdentityRepo.listByUser(tenantId, userId);

    if (!user.passwordCredential && links.length <= 1) {
      await this.recordAudit({
        tenantId,
        userId,
        category: 'SECURITY',
        severity: 'WARN',
        action: 'ACCESS_DENIED',
        resourceType: 'identity_provider_link',
        resourceId: identity.id,
        success: false,
        reason: 'LastLoginMethodCannotBeUnlinked',
        metadata: { provider: identity.provider },
      });
      throw new Error('LastLoginMethodCannotBeUnlinked');
    }

    await this.userIdentityRepo.delete(identity.id);
    await this.recordAudit({
      tenantId,
      userId,
      category: 'SECURITY',
      action: 'UNLINK_IDP',
      resourceType: 'identity_provider_link',
      resourceId: identity.id,
      metadata: {
        provider: identity.provider,
        email: identity.email ?? null,
      },
    });
  }

  async updateProfile(
    tenantId: string,
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<void> {
    this.logger.log(
      `Updating profile for user ${userId} in tenant ${tenantId}`,
    );

    const user = orThrow(
      await this.userWriteRepo.findById(userId),
      new Error('UserNotFound'),
    );
    if (user.tenantId !== tenantId) throw new Error('TenantMismatch');
    if (user.status === 'WITHDRAWN') throw new Error('UserAlreadyWithdrawn');

    if (dto.email !== undefined) {
      user.changeEmail(dto.email ?? null);
    }
    if (dto.phone !== undefined) {
      user.changePhone(dto.phone ?? null);
    }

    await this.userWriteRepo.save(user);
  }

  private async createVerificationToken(params: {
    tenantId: string;
    userId: string;
    purpose: 'EMAIL_VERIFICATION' | 'PHONE_VERIFICATION';
    contact: string;
    ttlSec: number;
  }): Promise<string> {
    const requestId = ulid();
    const rawToken = this.otpHash.generateToken(32);
    const tokenHash = this.hashVerificationToken({
      token: rawToken,
      contact: params.contact,
    });
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + params.ttlSec * 1000);

    await this.otpToken.create({
      tenantId: params.tenantId,
      userId: params.userId,
      purpose: params.purpose,
      requestId,
      tokenHash,
      issuedAt,
      expiresAt,
    });

    return rawToken;
  }

  private hashVerificationToken(params: {
    token: string;
    contact: string;
  }): string {
    return this.otpHash.hash(`${params.contact.trim()}:${params.token.trim()}`);
  }

  private getTtlSec(key: string, fallback: number): number {
    const raw = this.configService.get<string>(key);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private getStringConfig(key: string, fallback: string): string {
    const value = this.configService.get<string>(key);
    return value?.trim() ? value.trim() : fallback;
  }

  private async createRecoveryCodes(userId: string): Promise<string[]> {
    const codes: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      const code = this.otpHash.generateToken(10);
      const hash = await this.passwordHash.hash(code);
      const credential = UserCredentialModel.of({
        type: 'recovery_code',
        secretHash: hash.hash,
        hashAlg: hash.alg,
        hashParams: hash.params,
        hashVersion: hash.version,
        enabled: true,
      });
      await this.userWriteRepo.createCredential(userId, credential);
      codes.push(code);
    }
    return codes;
  }

  private async recordAudit(params: {
    tenantId: string;
    userId?: string | null;
    category: 'AUTH' | 'USER' | 'SECURITY';
    severity?: 'INFO' | 'WARN' | 'ERROR';
    action: 'UPDATE' | 'UNLINK_IDP' | 'ACCESS_DENIED';
    resourceType: string;
    resourceId?: string | null;
    success?: boolean;
    reason?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    await this.eventRepo.save(
      new EventModel({
        tenantId: params.tenantId,
        userId: params.userId ?? null,
        category: params.category,
        severity: params.severity ?? 'INFO',
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId ?? null,
        success: params.success ?? true,
        reason: params.reason ?? null,
        metadata: params.metadata ?? null,
        occurredAt: new Date(),
      }),
    );
  }

  private assertActiveTenantUser(
    user: UserModel | undefined,
    tenantId: string,
  ): UserModel {
    const found = orThrow(user, new Error('UserNotFound'));
    if (found.tenantId !== tenantId) throw new Error('TenantMismatch');
    if (found.status === 'WITHDRAWN') throw new Error('UserAlreadyWithdrawn');
    return found;
  }

  async revokeConsent(
    tenantId: string,
    userId: string,
    clientId: string,
  ): Promise<void> {
    this.logger.log(
      `Revoking consent for user ${userId} in tenant ${tenantId} ${clientId}`,
    );

    const consent = orThrow(
      await this.consentRepo.findByTenantUserClient(tenantId, userId, clientId),
      new Error('ConsentNotFound'),
    );
    if (consent.isRevoked) return;

    consent.revoke();
    await this.consentRepo.save(consent);
  }
}
