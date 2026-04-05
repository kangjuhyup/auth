import { Injectable } from '@nestjs/common';
import { pbkdf2 as pbkdf2Cb, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { PasswordHash } from '../password-hash';

const pbkdf2 = promisify(pbkdf2Cb);

type Pbkdf2Params = {
  iterations?: number;
  keyLen?: number;
  digest?: 'sha256'; // 확장 가능
};

function asInt(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * 저장 포맷:
 * pbkdf2$sha256$<iterations>$<saltB64>$<dkB64>
 */
@Injectable()
export class Pbkdf2Sha256Hash implements PasswordHash {
  readonly alg = 'pbkdf2-sha256';

  async hash(plain: string, params?: Record<string, unknown>): Promise<string> {
    const p = (params ?? {}) as Pbkdf2Params;

    const iterations = asInt(p.iterations, 210_000);
    const keyLen = asInt(p.keyLen, 32);
    const digest = (p.digest ?? 'sha256') as 'sha256';

    const salt = randomBytes(16);
    const dk = await pbkdf2(
      plain,
      salt.toString('base64'),
      iterations,
      keyLen,
      digest,
    );

    return [
      'pbkdf2',
      digest,
      String(iterations),
      salt.toString('base64'),
      dk.toString('base64'),
    ].join('$');
  }

  async verify(stored: string, plain: string): Promise<boolean> {
    const parts = stored.split('$');
    if (parts.length !== 5) return false;
    const [prefix, digest, iterStr, saltB64, dkB64] = parts;
    if (prefix !== 'pbkdf2' || digest !== 'sha256') return false;

    const iterations = Number(iterStr);
    if (!Number.isFinite(iterations) || iterations <= 0) return false;

    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(dkB64, 'base64');

    const actual = await pbkdf2(
      plain,
      salt.toString('base64'),
      iterations,
      expected.length,
      'sha256',
    );
    return (
      expected.length === actual.length &&
      timingSafeEqual(Uint8Array.from(expected), Uint8Array.from(actual))
    );
  }
}
