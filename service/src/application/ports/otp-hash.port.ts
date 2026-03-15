export abstract class OtpHashPort {
  abstract generateToken(bytes: number): string;
  abstract hash(plain: string): string;
}
