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

    const audiences = toAudienceList((token as { aud?: unknown }).aud);
    if (!audiences) return false;

    const caller = await clientRepository.findByClientId(tenantId, clientId);
    if (
      !caller ||
      !caller.enabled ||
      caller.type !== 'service' ||
      caller.tokenEndpointAuthMethod !== 'client_secret_basic'
    ) {
      return false;
    }

    const owned = toNormalizedOriginSet(
      caller.introspectionResources as unknown,
    );
    if (!owned) return false;

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

function isWhitespaceExactNonEmptyString(value: unknown): value is string {
  return isNonEmptyString(value) && value === value.trim();
}

function toAudienceList(value: unknown): string[] | null {
  if (isWhitespaceExactNonEmptyString(value)) return [value];
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every(isWhitespaceExactNonEmptyString)
  ) {
    return null;
  }
  return value;
}

function toNormalizedOriginSet(value: unknown): Set<string> | null {
  if (!Array.isArray(value)) return null;

  const origins = new Set<string>();
  for (const resource of value) {
    if (!isWhitespaceExactNonEmptyString(resource)) return null;

    let origin: string;
    try {
      origin = ResourceOrigin.of(resource).value;
    } catch {
      return null;
    }
    if (origin !== resource || origins.has(origin)) return null;
    origins.add(origin);
  }
  return origins;
}
