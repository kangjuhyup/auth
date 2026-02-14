import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PasswordHash } from '../password-hash';

type Argon2Params = {
  timeCost?: number;
  memoryCost?: number;
  parallelism?: number;
};

function asInt(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

@Injectable()
export class Argon2idHash implements PasswordHash {
  readonly alg = 'argon2id';

  async hash(plain: string, params?: Record<string, unknown>): Promise<string> {
    const p = (params ?? {}) as Argon2Params;

    const timeCost = asInt(p.timeCost, 2);
    const memoryCost = asInt(p.memoryCost, 19456);
    const parallelism = asInt(p.parallelism, 1);

    return argon2.hash(plain, {
      type: argon2.argon2id,
      timeCost,
      memoryCost,
      parallelism,
    });
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  }
}
