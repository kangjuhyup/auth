import {
  createCipheriv,
  createDecipheriv,
  createSecretKey,
  randomBytes,
  KeyObject,
} from 'crypto';
import { Injectable } from '@nestjs/common';
import { SymmetricCryptoPort } from '@application/ports/symmetric-crypto.port';

const IV_LEN = 12;
const AUTH_TAG_LEN = 16;

@Injectable()
export class SymmetricCryptoAdapter implements SymmetricCryptoPort {
  private readonly key: KeyObject;

  constructor(encryptionKey: string) {
    const hexBuf = Buffer.from(encryptionKey, 'hex');
    const buf = hexBuf.length === 32 ? hexBuf : Buffer.from(encryptionKey, 'base64');

    if (buf.length !== 32) {
      throw new Error(
        'Encryption key must be exactly 32 bytes (hex 64 chars or base64 44 chars)',
      );
    }
    this.key = createSecretKey(Uint8Array.from(buf));
  }

  encrypt(plaintext: string): string {
    const iv = Uint8Array.from(randomBytes(IV_LEN));
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);

    const part1 = Uint8Array.from(cipher.update(plaintext, 'utf8'));
    const part2 = Uint8Array.from(cipher.final());
    const authTag = Uint8Array.from(cipher.getAuthTag());

    const total = iv.length + authTag.length + part1.length + part2.length;
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of [iv, authTag, part1, part2]) {
      out.set(chunk, offset);
      offset += chunk.length;
    }

    return Buffer.from(out).toString('base64');
  }

  decrypt(ciphertext: string): string {
    const raw = Uint8Array.from(Buffer.from(ciphertext, 'base64'));

    if (raw.length < IV_LEN + AUTH_TAG_LEN) {
      throw new Error('Invalid ciphertext: too short');
    }

    const iv = raw.slice(0, IV_LEN);
    const authTag = raw.slice(IV_LEN, IV_LEN + AUTH_TAG_LEN);
    const encrypted = raw.slice(IV_LEN + AUTH_TAG_LEN);

    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);

    const part1 = decipher.update(encrypted, undefined, 'utf8');
    const part2 = decipher.final('utf8');

    return part1 + part2;
  }
}
