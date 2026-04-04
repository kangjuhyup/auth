import type { UserWriteRepositoryPort } from '@application/commands/ports/user-write-repository.port';
import type {
  UserClaimsView,
  UserProfileView,
  UserQueryPort,
} from '@application/queries/ports/user-query.port';
import type { PasswordHashPort } from '@application/ports/password-hash.port';
import type { MfaVerificationPort, MfaMethodType } from '@application/ports/mfa-verification.port';

export class UserQueryHandler implements UserQueryPort {
  constructor(
    private readonly userWriteRepository: UserWriteRepositoryPort,
    private readonly passwordHash: PasswordHashPort,
    private readonly mfaVerification: MfaVerificationPort,
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

    switch (params.method) {
      case 'totp':
        return this.verifyTotpMfa(params.userId, params.code);

      case 'webauthn':
        return this.verifyWebAuthnMfa(
          params.userId,
          params.rpId,
          params.expectedOrigin,
          params.webauthnResponse,
        );

      case 'recovery_code':
        return this.verifyRecoveryCodeMfa(params.userId, params.code);

      default:
        return false;
    }
  }

  private async verifyTotpMfa(
    userId: string,
    code?: string,
  ): Promise<boolean> {
    if (!code) return false;

    const [cred] = await this.userWriteRepository.findCredentialsByType(
      userId,
      ['totp'],
    );
    if (!cred) return false;

    return this.mfaVerification.verifyTotp(cred.secretHash, code);
  }

  private async verifyWebAuthnMfa(
    userId: string,
    rpId?: string,
    expectedOrigin?: string,
    webauthnResponse?: Record<string, unknown>,
  ): Promise<boolean> {
    if (!webauthnResponse || !rpId || !expectedOrigin) return false;

    const credentialId = (webauthnResponse as any)?.id as string | undefined;
    if (!credentialId) return false;

    const credentials = await this.userWriteRepository.findCredentialsByType(
      userId,
      ['webauthn'],
    );

    const matchingCred = credentials.find((c) => {
      const meta = c.hashParams;
      return meta?.credentialID === credentialId;
    });
    if (!matchingCred) return false;

    try {
      const result = await this.mfaVerification.verifyWebAuthn({
        credentialPublicKey: matchingCred.secretHash,
        credentialId,
        counter: (matchingCred.hashParams?.counter as number) ?? 0,
        rpId,
        expectedOrigin,
        response: webauthnResponse,
      });

      if (result.verified) {
        matchingCred.updateHashParams({
          ...matchingCred.hashParams,
          counter: result.newCounter,
        });
        await this.userWriteRepository.saveCredential(matchingCred);
      }

      return result.verified;
    } catch {
      return false;
    }
  }

  private async verifyRecoveryCodeMfa(
    userId: string,
    code?: string,
  ): Promise<boolean> {
    if (!code) return false;

    const credentials = await this.userWriteRepository.findCredentialsByType(
      userId,
      ['recovery_code'],
    );

    for (const cred of credentials) {
      try {
        const isValid = await this.mfaVerification.verifyRecoveryCode(
          cred.secretHash,
          code,
        );
        if (isValid) {
          cred.disable();
          await this.userWriteRepository.saveCredential(cred);
          return true;
        }
      } catch {
        continue;
      }
    }

    return false;
  }
}
