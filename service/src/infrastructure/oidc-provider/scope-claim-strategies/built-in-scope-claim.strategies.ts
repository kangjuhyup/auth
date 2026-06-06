import type { ScopeClaimResolveParams } from '@application/ports/scope-claim-resolver.port';
import type { ScopeClaimStrategy } from './scope-claim-strategy';

abstract class BuiltInScopeClaimStrategy implements ScopeClaimStrategy {
  constructor(private readonly claimKey: string) {}

  supports(claimKey: string): boolean {
    return claimKey === this.claimKey;
  }

  abstract resolve(params: ScopeClaimResolveParams): Record<string, unknown>;
}

export class EmailScopeClaimStrategy extends BuiltInScopeClaimStrategy {
  constructor() {
    super('email');
  }

  resolve({ baseClaims }: ScopeClaimResolveParams): Record<string, unknown> {
    return {
      email: baseClaims.email,
      email_verified: baseClaims.email_verified,
    };
  }
}

export class ProfileScopeClaimStrategy extends BuiltInScopeClaimStrategy {
  constructor() {
    super('profile');
  }

  resolve({ baseClaims }: ScopeClaimResolveParams): Record<string, unknown> {
    return {
      preferred_username: baseClaims.username,
    };
  }
}

export class PhoneScopeClaimStrategy extends BuiltInScopeClaimStrategy {
  constructor() {
    super('phone');
  }

  resolve({ baseClaims }: ScopeClaimResolveParams): Record<string, unknown> {
    return {
      phone_number: baseClaims.phone,
      phone_number_verified: baseClaims.phone_verified,
    };
  }
}

export const BUILT_IN_SCOPE_CLAIM_STRATEGIES: readonly ScopeClaimStrategy[] = [
  new EmailScopeClaimStrategy(),
  new ProfileScopeClaimStrategy(),
  new PhoneScopeClaimStrategy(),
];
