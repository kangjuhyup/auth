import { Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { MfaVerificationPort } from '@application/ports/mfa-verification.port';
import type { WebAuthnVerifyResult } from '@application/ports/mfa-verification.port';
import {
  verifyAuthenticationResponse,
  generateAuthenticationOptions,
} from '@simplewebauthn/server';
import * as argon2 from 'argon2';

@Injectable()
export class MfaVerificationAdapter implements MfaVerificationPort {
  verifyTotp(secret: string, code: string): boolean {
    return this.verifyTotpCode(secret, code);
  }

  async generateWebAuthnAuthOptions(
    credentials: { credentialId: string }[],
    rpId: string,
  ): Promise<Record<string, unknown>> {
    const allowCredentials = credentials.map((c) => ({
      id: c.credentialId,
      type: 'public-key' as const,
    }));

    const options = await generateAuthenticationOptions({
      rpID: rpId,
      allowCredentials,
      userVerification: 'preferred',
    });

    return options as unknown as Record<string, unknown>;
  }

  async verifyWebAuthn(params: {
    credentialPublicKey: string;
    credentialId: string;
    counter: number;
    rpId: string;
    expectedOrigin: string;
    response: Record<string, unknown>;
  }): Promise<WebAuthnVerifyResult> {
    const publicKeyBuffer = Buffer.from(params.credentialPublicKey, 'base64');

    const verification = await verifyAuthenticationResponse({
      response: params.response as any,
      expectedChallenge: (params.response as any).challenge ?? '',
      expectedOrigin: params.expectedOrigin,
      expectedRPID: params.rpId,
      credential: {
        id: params.credentialId,
        publicKey: new Uint8Array(publicKeyBuffer),
        counter: params.counter,
      },
    });

    return {
      verified: verification.verified,
      newCounter: verification.authenticationInfo?.newCounter ?? params.counter,
    };
  }

  async verifyRecoveryCode(
    hashedCode: string,
    inputCode: string,
  ): Promise<boolean> {
    return argon2.verify(hashedCode, inputCode);
  }

  /* ─── TOTP (RFC 6238) using Node.js crypto ─── */

  private verifyTotpCode(secret: string, token: string, window = 1): boolean {
    const counter = Math.floor(Date.now() / 30000);
    for (let i = -window; i <= window; i++) {
      const generated = this.generateTotpCode(secret, counter + i);
      if (generated === token) return true;
    }
    return false;
  }

  private generateTotpCode(secret: string, counter: number): string {
    const buffer = Buffer.alloc(8);
    let tmp = counter;
    for (let i = 7; i >= 0; i--) {
      buffer[i] = tmp & 0xff;
      tmp = Math.floor(tmp / 256);
    }

    const secretBuffer = this.base32Decode(secret);
    const hmac = createHmac('sha1', secretBuffer as unknown as string)
      .update(buffer as unknown as string)
      .digest();

    const offset = hmac[hmac.length - 1] & 0xf;
    const code =
      (((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff)) %
      1000000;
    return code.toString().padStart(6, '0');
  }

  private base32Decode(encoded: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleaned = encoded.replace(/=+$/, '').toUpperCase();
    let bits = '';
    for (const char of cleaned) {
      const val = alphabet.indexOf(char);
      if (val === -1) continue;
      bits += val.toString(2).padStart(5, '0');
    }
    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push(parseInt(bits.substring(i, i + 8), 2));
    }
    return Buffer.from(bytes);
  }
}
