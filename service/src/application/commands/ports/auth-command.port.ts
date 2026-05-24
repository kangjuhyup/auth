import {
  SignupDto,
  WithdrawDto,
  ChangePasswordDto,
  PasswordResetRequestDto,
  PasswordResetDto,
  VerificationTokenDto,
  TotpEnrollmentResponse,
  TotpConfirmationDto,
  TotpConfirmationResponse,
  RotateRecoveryCodesResponse,
  UpdateMfaPreferenceDto,
  UpdateProfileDto,
  StartIdentityLinkDto,
  StartIdentityLinkResponse,
  CompleteIdentityLinkDto,
  CompleteIdentityLinkResponse,
} from '@application/dto';

export abstract class AuthCommandPort {
  /**
   * Sign up a new user
   * @description 신규 유저 회원가입
   */
  abstract signup(
    tenantId: string,
    dto: SignupDto,
  ): Promise<{ userId: string }>;

  /**
   * Withdraw a user
   * @description 유저 탈퇴
   */
  abstract withdraw(
    tenantId: string,
    userId: string,
    dto: WithdrawDto,
  ): Promise<void>;

  /**
   * Change the password of a user
   * @description 유저 비밀번호 변경
   */
  abstract changePassword(
    tenantId: string,
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<void>;

  /**
   * Request a password reset
   * @description 비밀번호 초기화 요청
   */
  abstract requestPasswordReset(
    tenantId: string,
    dto: PasswordResetRequestDto,
  ): Promise<void>;

  /**
   * Reset password with token
   * @description 토큰 기반 비밀번호 초기화
   */
  abstract resetPassword(
    tenantId: string,
    userId: string,
    dto: PasswordResetDto,
  ): Promise<void>;

  /**
   * Request email verification for the authenticated user
   * @description 현재 사용자 이메일 인증 요청
   */
  abstract requestEmailVerification(
    tenantId: string,
    userId: string,
  ): Promise<void>;

  /**
   * Verify email with token
   * @description 토큰 기반 이메일 인증 완료
   */
  abstract verifyEmail(
    tenantId: string,
    userId: string,
    dto: VerificationTokenDto,
  ): Promise<void>;

  /**
   * Request phone verification for the authenticated user
   * @description 현재 사용자 전화번호 인증 요청
   */
  abstract requestPhoneVerification(
    tenantId: string,
    userId: string,
  ): Promise<void>;

  /**
   * Verify phone with token
   * @description 토큰 기반 전화번호 인증 완료
   */
  abstract verifyPhone(
    tenantId: string,
    userId: string,
    dto: VerificationTokenDto,
  ): Promise<void>;

  /**
   * Begin TOTP MFA enrollment
   * @description 현재 사용자 TOTP MFA 등록 시작
   */
  abstract beginTotpEnrollment(
    tenantId: string,
    userId: string,
  ): Promise<TotpEnrollmentResponse>;

  /**
   * Confirm TOTP MFA enrollment
   * @description TOTP 코드 검증 후 MFA 등록 완료
   */
  abstract confirmTotpEnrollment(
    tenantId: string,
    userId: string,
    dto: TotpConfirmationDto,
  ): Promise<TotpConfirmationResponse>;

  /**
   * Disable TOTP MFA
   * @description 현재 사용자 TOTP MFA 비활성화
   */
  abstract disableTotp(tenantId: string, userId: string): Promise<void>;

  /**
   * Rotate recovery codes
   * @description 기존 복구 코드를 폐기하고 새 복구 코드를 발급
   */
  abstract rotateRecoveryCodes(
    tenantId: string,
    userId: string,
  ): Promise<RotateRecoveryCodesResponse>;

  /**
   * Update MFA login preference
   * @description 등록된 MFA 수단을 로그인에 사용할지 선택
   */
  abstract updateMfaPreference(
    tenantId: string,
    userId: string,
    dto: UpdateMfaPreferenceDto,
  ): Promise<void>;

  /**
   * Start external identity provider account linking
   * @description 현재 사용자 외부 IdP 계정 연결 시작
   */
  abstract startIdentityLink(
    tenantId: string,
    userId: string,
    dto: StartIdentityLinkDto,
  ): Promise<StartIdentityLinkResponse>;

  /**
   * Complete external identity provider account linking
   * @description 외부 IdP callback으로 현재 사용자 계정 연결 완료
   */
  abstract completeIdentityLink(
    dto: CompleteIdentityLinkDto,
  ): Promise<CompleteIdentityLinkResponse>;

  /**
   * Unlink an external identity provider account
   * @description 현재 사용자 외부 IdP 연결 해제
   */
  abstract unlinkIdentity(
    tenantId: string,
    userId: string,
    identityId: string,
  ): Promise<void>;

  /**
   * Update the profile of a user
   * @description 유저 정보 업데이트
   */
  abstract updateProfile(
    tenantId: string,
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<void>;

  /**
   * Revoke consent for a user
   * @description 유저 동의 취소
   */
  abstract revokeConsent(
    tenantId: string,
    userId: string,
    clientId: string,
  ): Promise<void>;
}
