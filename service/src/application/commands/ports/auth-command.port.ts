import {
  SignupDto,
  WithdrawDto,
  ChangePasswordDto,
  PasswordResetRequestDto,
  PasswordResetDto,
  UpdateProfileDto,
} from '@application/dto';

export abstract class AuthCommandPort {
  /**
   * Sign up a new user
   * @description 신규 유저 회원가입
   */
  abstract signup(tenantId: string, dto: SignupDto): Promise<{ userId: string }>;

  /**
   * Withdraw a user
   * @description 유저 탈퇴
   */
  abstract withdraw(tenantId: string, userId: string, dto: WithdrawDto): Promise<void>;

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
