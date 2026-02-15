import type { ProfileResponse } from '@application/dto';
import type { UserQueryPort } from '@application/queries/ports/user-query.port';

export class UserQueryService {
  constructor(private readonly userQuery: UserQueryPort) {}

  async getProfile(params: {
    tenantId: string;
    userId: string;
  }): Promise<ProfileResponse> {
    const view = await this.userQuery.findProfile(params);
    if (!view) throw new Error('UserNotFound');

    if (view.status === 'WITHDRAWN') throw new Error('UserWithdrawn');

    return {
      id: view.userId,
      username: view.username,
      email: view.email ?? null,
      emailVerified: view.emailVerified,
      phone: view.phone ?? null,
      phoneVerified: view.phoneVerified,
      status: view.status,
      createdAt: view.createdAt,
      updatedAt: view.updatedAt,
    };
  }

  /**
   * OIDC findAccount에서 사용할 최소 claims 조회
   * - sub == userId(ULID) 가정
   */
  async findAccountClaimsBySub(params: {
    tenantId: string;
    sub: string;
  }): Promise<{
    accountId: string;
    claims: () => Promise<Record<string, unknown>>;
  } | null> {
    const view = await this.userQuery.findClaimsBySub(params);
    if (!view) return null;

    // 화이트리스트 claims만 반환 (민감정보 누출 방지)
    return {
      accountId: String(view.sub),
      claims: async () => ({
        sub: view.sub,
        email: view.email ?? undefined,
        email_verified: view.email_verified ?? undefined,
      }),
    };
  }
}
