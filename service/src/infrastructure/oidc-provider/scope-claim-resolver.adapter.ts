import { Injectable, Optional } from '@nestjs/common';
import { ScopeClaimResolverPort } from '@application/ports/scope-claim-resolver.port';
import type { ScopeClaimResolveParams } from '@application/ports/scope-claim-resolver.port';
import {
  BUILT_IN_SCOPE_CLAIM_STRATEGIES,
  type ScopeClaimStrategy,
} from './scope-claim-strategies';

@Injectable()
export class OidcScopeClaimResolverAdapter extends ScopeClaimResolverPort {
  constructor(
    @Optional()
    private readonly strategies: readonly ScopeClaimStrategy[] = BUILT_IN_SCOPE_CLAIM_STRATEGIES,
  ) {
    super();
  }

  async resolve(
    params: ScopeClaimResolveParams,
  ): Promise<Record<string, unknown>> {
    const claims: Record<string, unknown> = { sub: params.baseClaims.sub };

    for (const claimKey of params.claimKeys) {
      const strategy = this.strategies.find((candidate) =>
        candidate.supports(claimKey),
      );
      if (!strategy) {
        continue;
      }

      Object.assign(claims, stripUndefined(strategy.resolve(params)));
    }

    return claims;
  }
}

function stripUndefined(
  claims: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(claims).filter(([, value]) => value !== undefined),
  );
}
