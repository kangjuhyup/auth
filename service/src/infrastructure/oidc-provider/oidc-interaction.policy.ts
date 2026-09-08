import type { interactionPolicy } from 'oidc-provider';

export type OidcInteractionPolicyRuntime = typeof interactionPolicy;

export function buildOidcInteractionPolicy(
  runtime: OidcInteractionPolicyRuntime,
): interactionPolicy.DefaultPolicy {
  const policy = runtime.base();
  policy.add(new runtime.Prompt({ name: 'create', requestable: true }), 0);
  return policy;
}
