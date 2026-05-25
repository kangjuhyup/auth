import { Injectable } from '@nestjs/common';
import { ScopeClaimResolverPort } from '@application/ports/scope-claim-resolver.port';
import type { ScopeClaimResolveParams } from '@application/ports/scope-claim-resolver.port';

type ClaimResolver = (
  params: ScopeClaimResolveParams,
) => Record<string, unknown>;

const RESOLVERS: Record<string, ClaimResolver> = {
  email: ({ baseClaims }) => ({
    email: baseClaims.email,
    email_verified: baseClaims.email_verified,
  }),
  profile: ({ baseClaims }) => ({
    preferred_username: baseClaims.username,
  }),
  phone: ({ baseClaims }) => ({
    phone_number: baseClaims.phone,
    phone_number_verified: baseClaims.phone_verified,
  }),
};

@Injectable()
export class OidcScopeClaimResolverAdapter extends ScopeClaimResolverPort {
  async resolve(
    params: ScopeClaimResolveParams,
  ): Promise<Record<string, unknown>> {
    const claims: Record<string, unknown> = { sub: params.baseClaims.sub };

    for (const claimKey of params.claimKeys) {
      const resolver = RESOLVERS[claimKey];
      if (!resolver) {
        continue;
      }

      Object.assign(claims, stripUndefined(resolver(params)));
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
