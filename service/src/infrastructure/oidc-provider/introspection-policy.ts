import type {
  AccessToken,
  Client,
  ClientCredentials,
  KoaContextWithOIDC,
  RefreshToken,
} from 'oidc-provider';
import type { ClientRepository } from '@domain/repositories';
import { ResourceOrigin } from '@domain/value-objects/resource-origin';

export function createIntrospectionAllowedPolicy(
  clientRepository: ClientRepository,
) {
  return async (
    ctx: KoaContextWithOIDC,
    authenticatedClient: Client,
    token: AccessToken | ClientCredentials | RefreshToken,
  ): Promise<boolean> => {
    const tenantId = (ctx.req as { tenant?: { id?: string } })?.tenant?.id;
    if (!tenantId || !authenticatedClient.clientId) return false;
    if (!['AccessToken', 'ClientCredentials'].includes(token.kind)) {
      return false;
    }

    const caller = await clientRepository.findByClientId(
      tenantId,
      authenticatedClient.clientId,
    );
    if (
      !caller ||
      !caller.enabled ||
      caller.type !== 'service' ||
      caller.tokenEndpointAuthMethod !== 'client_secret_basic'
    ) {
      return false;
    }

    const tokenAudience = (token as { aud?: string | string[] }).aud;
    const audiences = Array.isArray(tokenAudience)
      ? tokenAudience
      : tokenAudience
        ? [tokenAudience]
        : [];
    const owned = new Set(caller.introspectionResources);

    return audiences.some((audience) => {
      try {
        return owned.has(ResourceOrigin.of(String(audience)).value);
      } catch {
        return false;
      }
    });
  };
}
