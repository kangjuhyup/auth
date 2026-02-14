import { Injectable } from '@nestjs/common';
import type {
  PasswordHashPort,
  HashPolicy,
  HashResult,
} from '@application/command/ports/password-hash.port';
import type { PasswordHash } from './password-hash';

export const PASSWORD_HASHERS = Symbol('PASSWORD_HASHERS');

function normalizePolicy(p?: HashPolicy): HashPolicy {
  return {
    alg: p?.alg ?? 'argon2id',
    params: p?.params ?? {},
    version: p?.version ?? 1,
  };
}

@Injectable()
export class PasswordHashAdapter implements PasswordHashPort {
  private readonly map = new Map<string, PasswordHash>();

  constructor(
    hashers: PasswordHash[],
    private readonly defaultHashPolicy: HashPolicy,
  ) {
    for (const h of hashers) this.map.set(h.alg, h);
    const d = normalizePolicy(defaultHashPolicy);
    if (!this.map.has(d.alg))
      throw new Error(`DefaultHashAlgNotRegistered:${d.alg}`);
  }

  defaultPolicy(): HashPolicy {
    return normalizePolicy(this.defaultHashPolicy);
  }

  async hash(plain: string, policy?: HashPolicy): Promise<HashResult> {
    const p = normalizePolicy(policy ?? this.defaultPolicy());
    const hasher = this.map.get(p.alg);
    if (!hasher) throw new Error(`UnsupportedAlgorithm:${p.alg}`);

    const hash = await hasher.hash(plain, p.params);

    return { alg: p.alg, params: p.params, version: p.version, hash };
  }

  async verify(hash: string, plain: string, alg: string): Promise<boolean> {
    const hasher = this.map.get(alg);
    if (!hasher) throw new Error(`UnsupportedAlgorithm:${alg}`);
    return hasher.verify(hash, plain);
  }
}
