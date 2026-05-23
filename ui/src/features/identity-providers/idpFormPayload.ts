import type {
  CreateIdentityProviderDto,
  IdpProtocol,
  IdpSamlConfig,
  UpdateIdentityProviderDto,
} from '@/types/identity-provider.types';

export interface IdpFormValues extends Record<
  string,
  string | number | boolean | undefined
> {
  provider?: string;
  protocol?: IdpProtocol;
  displayName?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  enabled?: boolean;
  oauthConfigJson?: string;
  samlEntryPoint?: string;
  samlIdpCerts?: string;
  samlIdpIssuer?: string;
  samlAudience?: string;
  samlIdentifierFormat?: string;
  samlAcceptedClockSkewMs?: number;
  samlMaxAssertionAgeMs?: number;
  samlRequestIdExpirationMs?: number;
  samlWantAssertionsSigned?: boolean;
  samlWantAuthnResponseSigned?: boolean;
  samlForceAuthn?: boolean;
  samlDisableRequestedAuthnContext?: boolean;
  samlAuthnContext?: string;
  samlAttributeSub?: string;
  samlAttributeEmail?: string;
}

export class IdpFormPayloadError extends Error {
  constructor(
    public readonly field: keyof IdpFormValues,
    message: string,
  ) {
    super(message);
  }
}

function trimToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function optionalNumber(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

export function parseOauthJson(
  raw: string | undefined,
): Record<string, unknown> | null {
  if (raw == null || raw.trim() === '') return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new IdpFormPayloadError(
      'oauthConfigJson',
      'OAuth config must be valid JSON',
    );
  }
}

export function splitDelimitedValues(raw: string | undefined): string[] {
  return (
    raw
      ?.split(/[\n,]+/)
      .map((part) => part.trim())
      .filter(Boolean) ?? []
  );
}

export function parseSamlCertificates(raw: string | undefined): string[] {
  const value = raw?.trim();
  if (!value) {
    throw new IdpFormPayloadError(
      'samlIdpCerts',
      'At least one IdP certificate is required',
    );
  }

  const pemMatches = value.match(
    /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g,
  );
  if (pemMatches?.length) {
    return pemMatches.map((cert) => cert.trim());
  }

  return value
    .split(/\n{2,}/)
    .map((cert) => cert.trim())
    .filter(Boolean);
}

function buildSamlConfig(values: IdpFormValues): IdpSamlConfig {
  const entryPoint = trimToUndefined(values.samlEntryPoint);
  if (!entryPoint) {
    throw new IdpFormPayloadError(
      'samlEntryPoint',
      'SAML entry point is required',
    );
  }

  const attributeMapping = {
    sub: trimToUndefined(values.samlAttributeSub),
    email: trimToUndefined(values.samlAttributeEmail),
  };
  const hasAttributeMapping =
    attributeMapping.sub !== undefined || attributeMapping.email !== undefined;

  return {
    entryPoint,
    idpCerts: parseSamlCertificates(values.samlIdpCerts),
    idpIssuer: trimToUndefined(values.samlIdpIssuer),
    audience: trimToUndefined(values.samlAudience),
    identifierFormat: trimToUndefined(values.samlIdentifierFormat) ?? undefined,
    acceptedClockSkewMs: optionalNumber(values.samlAcceptedClockSkewMs),
    maxAssertionAgeMs: optionalNumber(values.samlMaxAssertionAgeMs),
    requestIdExpirationMs: optionalNumber(values.samlRequestIdExpirationMs),
    wantAssertionsSigned: values.samlWantAssertionsSigned,
    wantAuthnResponseSigned: values.samlWantAuthnResponseSigned,
    forceAuthn: values.samlForceAuthn,
    disableRequestedAuthnContext: values.samlDisableRequestedAuthnContext,
    authnContext: splitDelimitedValues(values.samlAuthnContext),
    attributeMapping: hasAttributeMapping ? attributeMapping : undefined,
  };
}

export function buildIdpPayload(
  values: IdpFormValues,
): CreateIdentityProviderDto | UpdateIdentityProviderDto {
  const protocol = values.protocol ?? 'oauth2';
  const base = {
    provider: values.provider,
    protocol,
    displayName: values.displayName,
    clientId: values.clientId,
    clientSecret: values.clientSecret,
    redirectUri: values.redirectUri,
    enabled: values.enabled,
  };

  if (protocol === 'saml2') {
    return {
      ...base,
      clientSecret: null,
      oauthConfig: null,
      samlConfig: buildSamlConfig(values),
    } as CreateIdentityProviderDto | UpdateIdentityProviderDto;
  }

  return {
    ...base,
    oauthConfig: parseOauthJson(values.oauthConfigJson),
    samlConfig: null,
  } as CreateIdentityProviderDto | UpdateIdentityProviderDto;
}
