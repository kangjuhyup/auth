export interface PasswordHash {
  readonly alg: string;
  hash(plain: string, params?: Record<string, unknown>): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}
