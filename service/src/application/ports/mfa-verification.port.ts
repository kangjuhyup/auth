export type MfaMethodType = 'totp' | 'webauthn' | 'recovery_code';

export interface WebAuthnVerifyResult {
  verified: boolean;
  newCounter: number;
}

export abstract class MfaVerificationPort {
  abstract verifyTotp(secret: string, code: string): boolean;

  abstract generateWebAuthnAuthOptions(
    credentials: { credentialId: string }[],
    rpId: string,
  ): Promise<Record<string, unknown>>;

  abstract verifyWebAuthn(params: {
    credentialPublicKey: string;
    credentialId: string;
    counter: number;
    rpId: string;
    expectedOrigin: string;
    response: Record<string, unknown>;
  }): Promise<WebAuthnVerifyResult>;

  abstract verifyRecoveryCode(
    hashedCode: string,
    inputCode: string,
  ): Promise<boolean>;
}
