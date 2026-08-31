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
    const tenantId = (
      ctx?.req as { tenant?: { id?: unknown } } | null | undefined
    )?.tenant?.id;
    const clientId = (authenticatedClient as { clientId?: unknown } | null)
      ?.clientId;
    const tokenKind = (token as { kind?: unknown } | null)?.kind;
    if (!isNonEmptyString(tenantId) || !isNonEmptyString(clientId)) {
      return false;
    }
    if (tokenKind !== 'AccessToken' && tokenKind !== 'ClientCredentials') {
      return false;
    }

    const caller = await clientRepository.findByClientId(tenantId, clientId);
    if (
      !caller ||
      !caller.enabled ||
      caller.type !== 'service' ||
      caller.tokenEndpointAuthMethod !== 'client_secret_basic'
    ) {
      return false;
    }

    const tokenAudience = (token as { aud?: unknown }).aud;
    const audiences = Array.isArray(tokenAudience)
      ? tokenAudience.filter((audience): audience is string =>
          isNonEmptyString(audience),
        )
      : isNonEmptyString(tokenAudience)
        ? [tokenAudience]
        : [];
    const allowlist = caller.introspectionResources as unknown;
    if (
      !Array.isArray(allowlist) ||
      !allowlist.every((resource) => isNonEmptyString(resource))
    ) {
      return false;
    }
    const owned = new Set(allowlist);

    return audiences.some((audience) => {
      try {
        return owned.has(ResourceOrigin.of(audience).value);
      } catch {
        return false;
      }
    });
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
