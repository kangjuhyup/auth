import { Injectable } from '@nestjs/common';
import { Logging, LogLevel } from '@kangjuhyup/rvlog';
import {
  ConsentResponse,
  IdentityLinkResponse,
  ProfileResponse,
  RecoveryCodeStatusResponse,
} from '@application/dto';
import { AuthQueryPort } from '@application/queries/ports/auth-query.port';
import { UserQueryPort } from '@application/queries/ports/user-query.port';
import { ConsentRepository } from '@domain/repositories/consent.repository';
import { UserIdentityRepository } from '@domain/repositories/user-identity.repository';
import { orThrow } from '@domain/utils';

@Injectable()
@Logging({ level: LogLevel.DEBUG })
export class AuthQueryHandler implements AuthQueryPort {
  constructor(
    private readonly userQuery: UserQueryPort,
    private readonly consentRepo: ConsentRepository,
    private readonly userIdentityRepo: UserIdentityRepository,
  ) {}

  async getProfile(tenantId: string, userId: string): Promise<ProfileResponse> {
    const view = orThrow(
      await this.userQuery.findProfile({ tenantId, userId }),
      new Error('UserNotFound'),
    );

    if (view.status === 'WITHDRAWN') {
      throw new Error('UserWithdrawn');
    }

    return ProfileResponse.of({
      id: view.userId,
      username: view.username,
      email: view.email ?? null,
      emailVerified: view.emailVerified,
      phone: view.phone ?? null,
      phoneVerified: view.phoneVerified,
      status: view.status,
      mfaEnabled: view.mfaEnabled,
      createdAt: view.createdAt,
      updatedAt: view.updatedAt,
    });
  }

  async getConsents(
    tenantId: string,
    userId: string,
  ): Promise<ConsentResponse[]> {
    const consents = await this.consentRepo.listAllByUser(tenantId, userId);

    return consents.map((consent) =>
      ConsentResponse.of({
        clientId: consent.clientId ?? consent.clientRefId,
        clientName: consent.clientName ?? 'Unknown',
        grantedScopes: consent.grantedScopes,
        grantedAt: consent.grantedAt,
      }),
    );
  }

  async getIdentityLinks(
    tenantId: string,
    userId: string,
  ): Promise<IdentityLinkResponse[]> {
    const identities = await this.userIdentityRepo.listByUser(tenantId, userId);
    return identities.map((identity) =>
      IdentityLinkResponse.of({
        id: identity.id,
        provider: identity.provider,
        email: identity.email ?? null,
        linkedAt: identity.linkedAt,
      }),
    );
  }

  async getRecoveryCodeStatus(
    tenantId: string,
    userId: string,
  ): Promise<RecoveryCodeStatusResponse> {
    const view = orThrow(
      await this.userQuery.findProfile({ tenantId, userId }),
      new Error('UserNotFound'),
    );

    if (view.status === 'WITHDRAWN') {
      throw new Error('UserWithdrawn');
    }

    return RecoveryCodeStatusResponse.of(
      await this.userQuery.getRecoveryCodeStatus(tenantId, userId),
    );
  }
}
