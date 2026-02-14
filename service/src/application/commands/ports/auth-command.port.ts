import {
  SignupDto,
  WithdrawDto,
  ChangePasswordDto,
  PasswordResetRequestDto,
  PasswordResetDto,
  UpdateProfileDto,
} from '@application/dto';

export const AUTH_COMMAND_PORT = Symbol('AUTH_COMMAND_PORT');

export interface AuthCommandPort {
  /**
   * Sign up a new user
   * @description 신규 유저 회원가입
   * @param tenantId - The tenant ID
   * @param dto - The signup DTO
   * @returns The user ID
   */
  signup(tenantId: string, dto: SignupDto): Promise<{ userId: string }>;
  /**
   * Withdraw a user
   * @description 유저 탈퇴
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param dto - The withdraw DTO
   * @returns The void
   */
  withdraw(tenantId: string, userId: string, dto: WithdrawDto): Promise<void>;
  /**
   * Change the password of a user
   * @description 유저 비밀번호 변경
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param dto - The change password DTO
   * @returns The void
   */
  changePassword(
    tenantId: string,
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<void>;

  /**
   * Request a password reset
   * @description 비밀번호 초기화 요청
   * @param tenantId - The tenant ID
   * @param dto - The password reset request DTO
   * @returns The void
   */
  requestPasswordReset(
    tenantId: string,
    dto: PasswordResetRequestDto,
  ): Promise<void>;

  /**
   * Reset password with token
   * @description 토큰 기반 비밀번호 초기화
   * @param tenantId - The tenant ID
   * @param dto - The password reset DTO
   * @returns The void
   */
  resetPassword(
    tenantId: string,
    userId: string,
    dto: PasswordResetDto,
  ): Promise<void>;

  /**
   * Update the profile of a user
   * @description 유저 정보 업데이트
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param dto - The update profile DTO
   * @returns The void
   */
  updateProfile(
    tenantId: string,
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<void>;

  /**
   * Revoke consent for a user
   * @description 유저 동의 취소
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param clientId - The client ID
   * @returns The void
   */
  revokeConsent(
    tenantId: string,
    userId: string,
    clientId: string,
  ): Promise<void>;
}
