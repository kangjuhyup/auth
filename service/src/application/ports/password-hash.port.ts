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

export abstract class PasswordHashPort {
  abstract defaultPolicy(): HashPolicy;
  abstract hash(plain: string, policy?: HashPolicy): Promise<HashResult>;
  abstract verify(hash: string, plain: string, alg: string): Promise<boolean>;
}
