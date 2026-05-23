export type IdpProtocol = 'oauth2' | 'saml2';

export interface IdpSamlAttributeMapping {
  sub?: string;
  email?: string;
}

export interface IdpSamlConfig {
  entryPoint: string;
  idpCerts: string[];
  idpIssuer?: string;
  audience?: string;
  identifierFormat?: string | null;
  acceptedClockSkewMs?: number;
  maxAssertionAgeMs?: number;
  requestIdExpirationMs?: number;
  wantAssertionsSigned?: boolean;
  wantAuthnResponseSigned?: boolean;
  forceAuthn?: boolean;
  disableRequestedAuthnContext?: boolean;
  authnContext?: string[];
  attributeMapping?: IdpSamlAttributeMapping;
}
