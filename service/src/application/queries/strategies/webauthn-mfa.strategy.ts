import { Injectable } from '@nestjs/common';
import { MfaVerificationPort } from '@application/ports/mfa-verification.port';
import { UserWriteRepositoryPort } from '@application/commands/ports/user-write-repository.port';
import type { MfaStrategy, MfaVerifyContext } from './mfa-strategy';

@Injectable()
export class WebAuthnMfaStrategy implements MfaStrategy {
  readonly method = 'webauthn' as const;

  constructor(
    private readonly userRepo: UserWriteRepositoryPort,
    private readonly mfa: MfaVerificationPort,
  ) {}

  async verify(ctx: MfaVerifyContext): Promise<boolean> {
    if (!ctx.webauthnResponse || !ctx.rpId || !ctx.expectedOrigin) return false;

    const credentialId = (ctx.webauthnResponse as any)?.id as
      | string
      | undefined;
    if (!credentialId) return false;

    const credentials = await this.userRepo.findCredentialsByType(ctx.userId, [
      'webauthn',
    ]);

    const matchingCred = credentials.find(
      (c) => c.hashParams?.credentialID === credentialId,
    );
    if (!matchingCred) return false;

    try {
      const result = await this.mfa.verifyWebAuthn({
        credentialPublicKey: matchingCred.secretHash,
        credentialId,
        counter: (matchingCred.hashParams?.counter as number) ?? 0,
        rpId: ctx.rpId,
        expectedOrigin: ctx.expectedOrigin,
        response: ctx.webauthnResponse,
      });

      if (result.verified) {
        matchingCred.updateHashParams({
          ...matchingCred.hashParams,
          counter: result.newCounter,
        });
        await this.userRepo.saveCredential(matchingCred);
      }

      return result.verified;
    } catch {
      return false;
    }
  }
}
