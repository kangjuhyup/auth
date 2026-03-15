import { OtpHashPort } from '@application/ports/otp-hash.port';
import crypto from 'crypto';

export class OtpHashAdapter implements OtpHashPort {
  constructor(private readonly secret: string) {
    if (!secret || secret.trim().length < 16) {
      throw new Error('OTP_TOKEN_SECRET is required (min length 16)');
    }
  }

  /** URL-safe token (평문) */
  generateToken(bytes: number = 32): string {
    const b64 = crypto.randomBytes(bytes).toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  /** 저장용 해시(HMAC-SHA256). 평문 저장 금지 */
  hash(plain: string): string {
    return crypto.createHmac('sha256', this.secret).update(plain).digest('hex');
  }
}
