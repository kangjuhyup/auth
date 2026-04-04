import { Injectable } from '@nestjs/common';
import { MfaVerificationPort } from '@application/ports/mfa-verification.port';
import { UserWriteRepositoryPort } from '@application/commands/ports/user-write-repository.port';
import type { MfaStrategy, MfaVerifyContext } from './mfa-strategy';

@Injectable()
export class TotpMfaStrategy implements MfaStrategy {
  readonly method = 'totp' as const;

  constructor(
    private readonly userRepo: UserWriteRepositoryPort,
    private readonly mfa: MfaVerificationPort,
  ) {}

  async verify(ctx: MfaVerifyContext): Promise<boolean> {
    if (!ctx.code) return false;

    const [cred] = await this.userRepo.findCredentialsByType(ctx.userId, [
      'totp',
    ]);
    if (!cred) return false;

    return this.mfa.verifyTotp(cred.secretHash, ctx.code);
  }
}
