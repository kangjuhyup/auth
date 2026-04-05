import {
  createCipheriv,
  createSecretKey,
  generateKeyPairSync,
  randomBytes,
  KeyObject,
} from 'crypto';
import { ulid } from 'ulid';
import { Injectable } from '@nestjs/common';
import {
  JwksKeyCryptoPort,
  GeneratedKeyPair,
} from '@application/ports/jwks-key-crypto.port';
import type { KeyAlgorithm } from '@domain/models/jwks-key';

@Injectable()
export class JwksKeyCryptoAdapter implements JwksKeyCryptoPort {
  /**
   * 비공개 키 암호화에 사용되는 AES-256-GCM KeyObject.
   * JWKS_ENCRYPTION_KEY 환경변수에서 hex(64자) 또는 base64(44자)로 설정한다.
   */
  private readonly encryptionKey: KeyObject;

  constructor(encryptionKey: string) {
    const hexBuf = Buffer.from(encryptionKey, 'hex');
    const buf = hexBuf.length === 32 ? hexBuf : Buffer.from(encryptionKey, 'base64');

    if (buf.length !== 32) {
      throw new Error(
        'JWKS_ENCRYPTION_KEY must be exactly 32 bytes (hex 64 chars or base64 44 chars)',
      );
    }
    this.encryptionKey = createSecretKey(Uint8Array.from(buf));
  }

  async generateKeyPair(algorithm: KeyAlgorithm = 'RS256'): Promise<GeneratedKeyPair> {
    const kid = ulid();
    const { publicKeyPem, privateKeyPem } = this.createKeyPair(algorithm);
    const privateKeyEncrypted = this.encryptPem(privateKeyPem);

    return { kid, algorithm, publicKeyPem, privateKeyEncrypted };
  }

  // ── private helpers ──────────────────────────────────────────────────────

  private createKeyPair(algorithm: KeyAlgorithm): { publicKeyPem: string; privateKeyPem: string } {
    if (algorithm === 'RS256') {
      const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      return { publicKeyPem: publicKey as string, privateKeyPem: privateKey as string };
    }

    const { publicKey, privateKey } = generateKeyPairSync('ec', {
      namedCurve: 'P-256',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    return { publicKeyPem: publicKey as string, privateKeyPem: privateKey as string };
  }

  /**
   * AES-256-GCM으로 PEM을 암호화한다.
   * 출력 형식: base64(iv[12] + authTag[16] + ciphertext)
   */
  private encryptPem(pem: string): string {
    const iv = Uint8Array.from(randomBytes(12));
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    // @types/node: Buffer → Uint8Array 변환으로 타입 호환
    const part1 = Uint8Array.from(cipher.update(pem, 'utf8'));
    const part2 = Uint8Array.from(cipher.final());
    const authTag = Uint8Array.from(cipher.getAuthTag());
    const ivArr = Uint8Array.from(iv);

    const total = ivArr.length + authTag.length + part1.length + part2.length;
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of [ivArr, authTag, part1, part2]) {
      out.set(chunk, offset);
      offset += chunk.length;
    }

    return Buffer.from(out).toString('base64');
  }
}
