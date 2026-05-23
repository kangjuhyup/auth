/** 내장 키(google, kakao, …) 또는 임의 slug — 후자는 OAuth 엔드포인트 JSON 필수 */
export type IdpProvider = string;
export type IdpProtocol = 'oauth2' | 'saml2';

export interface IdpOauthConfig {
  authorizationUrl?: string;
  tokenUrl?: string;
  userinfoUrl?: string;
  scopes?: string[];
  subField?: string;
  emailField?: string;
  extraAuthParams?: Record<string, string>;
}

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

export interface IdentityProviderResponse {
  id: string;
  provider: IdpProvider;
  protocol: IdpProtocol;
  displayName: string;
  clientId: string;
  clientSecretSet: boolean;
  redirectUri: string;
  enabled: boolean;
  oauthConfig: IdpOauthConfig | null;
  samlConfig: IdpSamlConfig | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIdentityProviderDto {
  provider: IdpProvider;
  protocol?: IdpProtocol;
  displayName: string;
  clientId: string;
  clientSecret?: string | null;
  redirectUri: string;
  enabled?: boolean;
  oauthConfig?: IdpOauthConfig | null;
  samlConfig?: IdpSamlConfig | null;
}

export interface UpdateIdentityProviderDto {
  protocol?: IdpProtocol;
  displayName?: string;
  clientId?: string;
  clientSecret?: string | null;
  redirectUri?: string;
  enabled?: boolean;
  oauthConfig?: IdpOauthConfig | null;
  samlConfig?: IdpSamlConfig | null;
}
