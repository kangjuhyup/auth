export const USER_QUERY_PORT = Symbol('USER_QUERY_PORT');

/**
 * User 읽기 전용 조회 인터페이스
 * - Projection 기반 조회 전용
 * - Aggregate/EventStore 접근 금지
 */
export interface UserQueryPort {
  /**
   * 프로필 조회 (UI / API용)
   */
  findProfile(params: {
    tenantId: string;
    userId: string;
  }): Promise<UserProfileView | null>;

  /**
   * OIDC findAccount 전용 Claims 조회
   * - sub 기반 조회
   */
  findClaimsBySub(params: {
    tenantId: string;
    sub: string;
  }): Promise<UserClaimsView | null>;

  /**
   * username 기반 조회 (관리자 화면용)
   */
  findByUsername(params: {
    tenantId: string;
    username: string;
  }): Promise<UserProfileView | null>;
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
