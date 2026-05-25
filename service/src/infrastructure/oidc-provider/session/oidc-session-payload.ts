import type { AdapterPayload } from 'oidc-provider';

export type OidcSessionAuthorization = Readonly<{
  clientId: string;
  grantId: string | null;
}>;

export type OidcSessionDescriptor = Readonly<{
  accountId: string;
  authorizations: OidcSessionAuthorization[];
}>;

export function extractOidcSessionDescriptor(
  payload: AdapterPayload,
): OidcSessionDescriptor | null {
  const source = unwrapPayload(payload);
  const accountId = stringValue(source.accountId ?? source.sub);
  if (!accountId) return null;

  const authorizations = extractAuthorizations(source);
  if (authorizations.length === 0) return null;

  return { accountId, authorizations };
}

function unwrapPayload(payload: AdapterPayload): Record<string, unknown> {
  const source = payload as unknown as Record<string, unknown>;
  const nested = source.payload;
  if (isRecord(nested)) {
    return nested;
  }

  return source;
}

function extractAuthorizations(
  payload: Record<string, unknown>,
): OidcSessionAuthorization[] {
  const authorizations = payload.authorizations;
  if (isRecord(authorizations)) {
    return Object.entries(authorizations)
      .map(([clientId, value]) => ({
        clientId,
        grantId: extractGrantId(value),
      }))
      .filter((entry) => entry.clientId.length > 0);
  }

  const clientId = stringValue(payload.clientId ?? payload.client_id);
  if (!clientId) return [];

  return [
    {
      clientId,
      grantId: stringValue(payload.grantId ?? payload.grant_id),
    },
  ];
}

function extractGrantId(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  if (!isRecord(value)) {
    return null;
  }

  return stringValue(value.grantId ?? value.grant_id);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
