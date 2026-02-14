export const PASSWORD_HASHER_PORT = Symbol('PASSWORD_HASHER_PORT');

export type HashPolicy = Readonly<{
  alg: string; // 'argon2id' | 'pbkdf2-sha256' | ...
  params?: Record<string, unknown>;
  version?: number;
}>;

export type HashResult = Readonly<{
  alg: string;
  params?: Record<string, unknown>;
  version?: number;
  hash: string;
}>;

export interface PasswordHashPort {
  defaultPolicy(): HashPolicy;
  hash(plain: string, policy?: HashPolicy): Promise<HashResult>;
  verify(hash: string, plain: string, alg: string): Promise<boolean>;
}
