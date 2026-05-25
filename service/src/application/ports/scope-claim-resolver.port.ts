import type { UserClaimsView } from '@application/queries/ports/user-query.port';

export interface ScopeClaimResolveParams {
  tenantId: string;
  subject: string;
  requestedScopes: string[];
  claimKeys: string[];
  baseClaims: UserClaimsView;
}

export abstract class ScopeClaimResolverPort {
  abstract resolve(
    params: ScopeClaimResolveParams,
  ): Promise<Record<string, unknown>>;
}
