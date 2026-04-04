import { Injectable } from '@nestjs/common';
import { MfaVerificationPort } from '@application/ports/mfa-verification.port';
import { UserWriteRepositoryPort } from '@application/commands/ports/user-write-repository.port';
import type { MfaStrategy, MfaVerifyContext } from './mfa-strategy';

@Injectable()
export class RecoveryCodeMfaStrategy implements MfaStrategy {
  readonly method = 'recovery_code' as const;

  constructor(
    private readonly userRepo: UserWriteRepositoryPort,
    private readonly mfa: MfaVerificationPort,
  ) {}

  async verify(ctx: MfaVerifyContext): Promise<boolean> {
    if (!ctx.code) return false;

    const credentials = await this.userRepo.findCredentialsByType(ctx.userId, [
      'recovery_code',
    ]);

    for (const cred of credentials) {
      try {
        const isValid = await this.mfa.verifyRecoveryCode(
          cred.secretHash,
          ctx.code,
        );
        if (isValid) {
          cred.disable();
          await this.userRepo.saveCredential(cred);
          return true;
        }
      } catch {
        continue;
      }
    }

    return false;
  }
}
