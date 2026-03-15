import {
  WithdrawDto,
  ChangePasswordDto,
  PasswordResetRequestDto,
  PasswordResetDto,
  UpdateProfileDto,
  SignupDto,
} from '@application/dto';
import { AuthCommandPort } from '../ports/auth-command.port';
import { BadRequestException, Logger } from '@nestjs/common';
import { ulid } from 'ulid';
import { UserModel } from '@domain/models/user';
import { UserCredentialModel } from '@domain/models/user-credential';
import { PasswordHashPort } from '@application/ports/password-hash.port';
import { OtpHashPort } from '@application/ports/otp-hash.port';
import { OtpTokenPort } from '@application/ports/otp-token.port';
import {
  NotificationPort,
  NOTIFICATION_PORT,
} from '@application/ports/notification.port';
import { UserWriteRepositoryPort } from '../ports/user-write-repository.port';

export class AuthCommandHandler implements AuthCommandPort {
  private readonly logger = new Logger(AuthCommandHandler.name);

  constructor(
    private readonly userWriteRepo: UserWriteRepositoryPort,
    private readonly passwordHash: PasswordHashPort,
    private readonly otpHash: OtpHashPort,
    private readonly otpToken: OtpTokenPort,
    private readonly notification: NotificationPort,
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

    const user = await this.userWriteRepo.findById(userId);
    if (!user) throw new Error('UserNotFound');
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
    this.logger.log(`Changing password for user ${userId} in tenant ${tenantId}`);

    const user = await this.userWriteRepo.findById(userId);
    if (!user) throw new Error('UserNotFound');
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

    const ttlSec = Number(process.env.OTP_PASSWORD_RESET_TTL_SEC ?? 15 * 60);
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

    const plain = dto.token?.trim();
    if (!plain) throw new Error('InvalidToken');

    const tokenHash = this.otpHash.hash(plain);

    const record = await this.otpToken.findValidByTokenHash({
      tenantId,
      purpose: 'PASSWORD_RESET',
      tokenHash,
    });
    if (!record) throw new Error('InvalidToken');

    const user = await this.userWriteRepo.findById(userId);
    if (!user) throw new Error('UserNotFound');
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

  updateProfile(
    tenantId: string,
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<void> {
    this.logger.log(`Updating profile for user ${userId} in tenant ${tenantId}`);
    throw new Error('Method not implemented.');
  }

  revokeConsent(
    tenantId: string,
    userId: string,
    clientId: string,
  ): Promise<void> {
    this.logger.log(
      `Revoking consent for user ${userId} in tenant ${tenantId} ${clientId}`,
    );
    throw new Error('Method not implemented.');
  }
}
