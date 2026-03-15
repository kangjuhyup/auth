import type { UserWriteRepositoryPort } from '@application/commands/ports/user-write-repository.port';
import type {
  UserClaimsView,
  UserProfileView,
  UserQueryPort,
} from '@application/queries/ports/user-query.port';

export class UserQueryHandler implements UserQueryPort {
  constructor(
    private readonly userWriteRepository: UserWriteRepositoryPort,
  ) {}

  async findProfile(params: {
    tenantId: string;
    userId: string;
  }): Promise<UserProfileView | null> {
    const user = await this.userWriteRepository.findById(params.userId);
    if (!user || user.tenantId !== params.tenantId) {
      return null;
    }

    return {
      userId: user.id,
      tenantId: user.tenantId,
      username: user.username,
      email: user.email ?? undefined,
      emailVerified: user.emailVerified,
      phone: user.phone ?? undefined,
      phoneVerified: user.phoneVerified,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async findClaimsBySub(params: {
    tenantId: string;
    sub: string;
  }): Promise<UserClaimsView | null> {
    const user = await this.userWriteRepository.findById(params.sub);
    if (!user || user.tenantId !== params.tenantId) {
      return null;
    }

    return {
      sub: user.id,
      email: user.email ?? undefined,
      email_verified: user.emailVerified,
    };
  }

  async findByUsername(params: {
    tenantId: string;
    username: string;
  }): Promise<UserProfileView | null> {
    const user = await this.userWriteRepository.findByUsername(
      params.tenantId,
      params.username,
    );
    if (!user) {
      return null;
    }

    return {
      userId: user.id,
      tenantId: user.tenantId,
      username: user.username,
      email: user.email ?? undefined,
      emailVerified: user.emailVerified,
      phone: user.phone ?? undefined,
      phoneVerified: user.phoneVerified,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
