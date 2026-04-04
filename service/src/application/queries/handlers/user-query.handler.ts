import { Inject } from '@nestjs/common';
import type { UserWriteRepositoryPort } from '@application/commands/ports/user-write-repository.port';
import type {
  UserClaimsView,
  UserProfileView,
  UserQueryPort,
} from '@application/queries/ports/user-query.port';
import type { PasswordHashPort } from '@application/ports/password-hash.port';
import type { MfaMethodType } from '@application/ports/mfa-verification.port';
import { MFA_STRATEGIES } from '@application/queries/strategies';
import type { MfaStrategy } from '@application/queries/strategies';

export class UserQueryHandler implements UserQueryPort {
  private readonly mfaStrategies: Map<MfaMethodType, MfaStrategy>;

  constructor(
    private readonly userWriteRepository: UserWriteRepositoryPort,
    private readonly passwordHash: PasswordHashPort,
    @Inject(MFA_STRATEGIES) strategies: MfaStrategy[],
  ) {
    this.mfaStrategies = new Map(strategies.map((s) => [s.method, s]));
  }

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

  async authenticate(params: {
    tenantId: string;
    username: string;
    password: string;
  }): Promise<{ userId: string } | null> {
    const user = await this.userWriteRepository.findByUsername(
      params.tenantId,
      params.username,
    );
    if (!user || user.status !== 'ACTIVE') return null;

    let credential;
    try {
      credential = user.getPasswordCredential();
    } catch {
      return null;
    }

    const ok = await this.passwordHash.verify(
      credential.secretHash,
      params.password,
      credential.hashAlg,
    );
    if (!ok) return null;

    return { userId: user.id };
  }

  async getMfaMethods(
    tenantId: string,
    userId: string,
  ): Promise<MfaMethodType[]> {
    const user = await this.userWriteRepository.findById(userId);
    if (!user || user.tenantId !== tenantId) return [];

    const credentials = await this.userWriteRepository.findCredentialsByType(
      userId,
      ['totp', 'webauthn', 'recovery_code'],
    );

    const methods = new Set<MfaMethodType>();
    for (const cred of credentials) {
      methods.add(cred.type as MfaMethodType);
    }
    return Array.from(methods);
  }

  async verifyMfa(params: {
    tenantId: string;
    userId: string;
    method: MfaMethodType;
    code?: string;
    webauthnResponse?: Record<string, unknown>;
    rpId?: string;
    expectedOrigin?: string;
  }): Promise<boolean> {
    const user = await this.userWriteRepository.findById(params.userId);
    if (!user || user.tenantId !== params.tenantId) return false;

    const strategy = this.mfaStrategies.get(params.method);
    if (!strategy) return false;

    return strategy.verify({
      userId: params.userId,
      code: params.code,
      webauthnResponse: params.webauthnResponse,
      rpId: params.rpId,
      expectedOrigin: params.expectedOrigin,
    });
  }
}
