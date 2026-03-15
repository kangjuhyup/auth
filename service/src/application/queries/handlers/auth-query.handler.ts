import type { ConsentResponse, ProfileResponse } from '@application/dto';
import type { AuthQueryPort } from '@application/queries/ports/auth-query.port';
import type { UserQueryPort } from '@application/queries/ports/user-query.port';

export class AuthQueryHandler implements AuthQueryPort {
  constructor(private readonly userQuery: UserQueryPort) {}

  async getProfile(tenantId: string, userId: string): Promise<ProfileResponse> {
    const view = await this.userQuery.findProfile({ tenantId, userId });
    if (!view) {
      throw new Error('UserNotFound');
    }

    if (view.status === 'WITHDRAWN') {
      throw new Error('UserWithdrawn');
    }

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

  async getConsents(
    _tenantId: string,
    _userId: string,
  ): Promise<ConsentResponse[]> {
    return [];
  }
}
