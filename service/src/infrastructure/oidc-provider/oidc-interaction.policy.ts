import type { interactionPolicy } from 'oidc-provider';

export type OidcInteractionPolicyRuntime = typeof interactionPolicy;

export function buildOidcInteractionPolicy(
  runtime: OidcInteractionPolicyRuntime,
): interactionPolicy.DefaultPolicy {
  return runtime.base();
}
