export type OtpPurpose = 'PASSWORD_RESET';

export type OtpTokenRecord = Readonly<{
  id: string;
  tenantId: string;
  userId: string;
  purpose: OtpPurpose;
  requestId: string;
  expiresAt: Date;
  consumedAt?: Date | null;
}>;

export abstract class OtpTokenPort {
  /**
   * OTP 토큰을 생성한다.
   */
  abstract create(params: {
    tenantId: string;
    userId: string;
    purpose: OtpPurpose;
    requestId: string;
    tokenHash: string;
    issuedAt: Date;
    expiresAt: Date;
  }): Promise<void>;

  /**
   * tokenHash로 유효한(미소비/미만료) OTP 토큰을 가져온다.
   * - 없으면 undefined
   */
  abstract findValidByTokenHash(params: {
    tenantId: string;
    purpose: OtpPurpose;
    tokenHash: string;
    now?: Date;
  }): Promise<OtpTokenRecord | undefined>;

  /**
   * 토큰을 소비(1회성) 처리한다.
   * - 멱등성: 이미 consumed면 그대로 반환/무시 가능
   */
  abstract consume(params: {
    tenantId: string;
    purpose: OtpPurpose;
    otpTokenId: string;
    consumedAt?: Date;
  }): Promise<void>;
}
