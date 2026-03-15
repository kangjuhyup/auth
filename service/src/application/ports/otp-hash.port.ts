export const OTP_HASH_PORT = Symbol('OTP_HASH_PORT');

export interface OtpHashPort {
  generateToken(bytes: number): string;
  hash(plain: string): string;
}
