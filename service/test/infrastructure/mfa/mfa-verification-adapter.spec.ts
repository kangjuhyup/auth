import { MfaVerificationAdapter } from '@infrastructure/mfa/mfa-verification.adapter';

describe('MfaVerificationAdapter', () => {
  let adapter: MfaVerificationAdapter;

  beforeEach(() => {
    adapter = new MfaVerificationAdapter();
  });

  // ── TOTP ──────────────────────────────────────────────────────────────────

  describe('verifyTotp', () => {
    // TOTP RFC 6238 base32 secret: "JBSWY3DPEHPK3PXP"
    const secret = 'JBSWY3DPEHPK3PXP';

    it('올바른 TOTP 코드 → true', () => {
      // 현재 counter 기준 생성한 코드는 true
      const counter = Math.floor(Date.now() / 30000);
      const code = generateTotpCode(secret, counter);

      expect(adapter.verifyTotp(secret, code)).toBe(true);
    });

    it('window 내 이전 counter 코드 → true (1 step 이전)', () => {
      const counter = Math.floor(Date.now() / 30000) - 1;
      const code = generateTotpCode(secret, counter);

      expect(adapter.verifyTotp(secret, code)).toBe(true);
    });

    it('오래된 코드(window 초과) → false', () => {
      const counter = Math.floor(Date.now() / 30000) - 5;
      const code = generateTotpCode(secret, counter);

      expect(adapter.verifyTotp(secret, code)).toBe(false);
    });

    it('잘못된 코드 → false', () => {
      expect(adapter.verifyTotp(secret, '000000')).toBe(false);
    });
  });

  // ── Recovery Code ─────────────────────────────────────────────────────────

  describe('verifyRecoveryCode', () => {
    it('argon2로 해싱된 코드 검증 성공', async () => {
      const argon2 = await import('argon2');
      const plain = 'ABCD-1234-EFGH-5678';
      const hashed = await argon2.hash(plain);

      const result = await adapter.verifyRecoveryCode(hashed, plain);

      expect(result).toBe(true);
    });

    it('잘못된 코드 → false', async () => {
      const argon2 = await import('argon2');
      const hashed = await argon2.hash('correct-code');

      const result = await adapter.verifyRecoveryCode(hashed, 'wrong-code');

      expect(result).toBe(false);
    });
  });

  // ── WebAuthn auth options ─────────────────────────────────────────────────

  describe('generateWebAuthnAuthOptions', () => {
    it('allowCredentials 포함한 옵션 반환', async () => {
      const credentials = [{ credentialId: 'cred-abc123' }];

      const options = await adapter.generateWebAuthnAuthOptions(
        credentials,
        'example.com',
      );

      expect(options).toBeDefined();
      expect(typeof options).toBe('object');
    });

    it('빈 credentials로도 옵션 생성', async () => {
      const options = await adapter.generateWebAuthnAuthOptions([], 'example.com');

      expect(options).toBeDefined();
    });
  });
});

// ── 테스트용 TOTP 코드 생성 헬퍼 ──────────────────────────────────────────
import { createHmac } from 'node:crypto';

function base32Decode(encoded: string): Buffer {
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

function generateTotpCode(secret: string, counter: number): string {
  const buffer = Buffer.alloc(8);
  let tmp = counter;
  for (let i = 7; i >= 0; i--) {
    buffer[i] = tmp & 0xff;
    tmp = Math.floor(tmp / 256);
  }
  const secretBuffer = base32Decode(secret);
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
