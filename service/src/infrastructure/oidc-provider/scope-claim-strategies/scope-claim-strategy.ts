import type { ScopeClaimResolveParams } from '@application/ports/scope-claim-resolver.port';

export interface ScopeClaimStrategy {
  supports(claimKey: string): boolean;
  resolve(params: ScopeClaimResolveParams): Record<string, unknown>;
}
