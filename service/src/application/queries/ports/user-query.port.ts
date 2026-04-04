export abstract class UserQueryPort {
  /**
   * 프로필 조회 (UI / API용)
   */
  abstract findProfile(params: {
    tenantId: string;
    userId: string;
  }): Promise<UserProfileView | null>;

  /**
   * OIDC findAccount 전용 Claims 조회
   * - sub 기반 조회
   */
  abstract findClaimsBySub(params: {
    tenantId: string;
    sub: string;
  }): Promise<UserClaimsView | null>;

  /**
   * username 기반 조회 (관리자 화면용)
   */
  abstract findByUsername(params: {
    tenantId: string;
    username: string;
  }): Promise<UserProfileView | null>;

  /**
   * OIDC 인터랙션 로그인용 자격증명 검증
   * - username + password 검증 후 userId 반환
   */
  abstract authenticate(params: {
    tenantId: string;
    username: string;
    password: string;
  }): Promise<{ userId: string } | null>;
}

/* ===============================
   Read Model Types
================================ */

export type UserProfileView = Readonly<{
  userId: string;
  tenantId: string;
  username: string;
  email?: string;
  emailVerified: boolean;
  phone?: string;
  phoneVerified: boolean;
  status: 'ACTIVE' | 'LOCKED' | 'DISABLED' | 'WITHDRAWN';
  createdAt?: Date;
  updatedAt?: Date;
}>;

export type UserClaimsView = Readonly<{
  sub: string;
  email?: string;
  email_verified?: boolean;
}>;
