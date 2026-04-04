import type { ConsentResponse, ProfileResponse } from '@application/dto';
import type { AuthQueryPort } from '@application/queries/ports/auth-query.port';
import type { UserQueryPort } from '@application/queries/ports/user-query.port';
import { ConsentRepository } from '@domain/repositories/consent.repository';
import { orThrow } from '@domain/utils';

export class AuthQueryHandler implements AuthQueryPort {
  constructor(
    private readonly userQuery: UserQueryPort,
    private readonly consentRepo: ConsentRepository,
  ) {}

  async getProfile(tenantId: string, userId: string): Promise<ProfileResponse> {
    const view = orThrow(
      await this.userQuery.findProfile({ tenantId, userId }),
      new Error('UserNotFound'),
    );

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
    tenantId: string,
    userId: string,
  ): Promise<ConsentResponse[]> {
    const consents = await this.consentRepo.listAllByUser(tenantId, userId);

    return consents.map((consent) => ({
      clientId: consent.clientId ?? consent.clientRefId,
      clientName: consent.clientName ?? 'Unknown',
      grantedScopes: consent.grantedScopes,
      grantedAt: consent.grantedAt,
    }));
  }
}
