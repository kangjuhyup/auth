import type { MfaMethodType } from '@application/ports/mfa-verification.port';

export const MFA_STRATEGIES = Symbol('MFA_STRATEGIES');

export interface MfaVerifyContext {
  userId: string;
  code?: string;
  webauthnResponse?: Record<string, unknown>;
  rpId?: string;
  expectedOrigin?: string;
}

export interface MfaStrategy {
  readonly method: MfaMethodType;
  verify(ctx: MfaVerifyContext): Promise<boolean>;
}
