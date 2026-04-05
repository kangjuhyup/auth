/** 내장 키(google, kakao, …) 또는 임의 slug — 후자는 OAuth 엔드포인트 JSON 필수 */
export type IdpProvider = string;

export interface IdpOauthConfig {
  authorizationUrl?: string;
  tokenUrl?: string;
  userinfoUrl?: string;
  scopes?: string[];
  subField?: string;
  emailField?: string;
  extraAuthParams?: Record<string, string>;
}

export interface IdentityProviderResponse {
  id: string;
  provider: IdpProvider;
  displayName: string;
  clientId: string;
  clientSecretSet: boolean;
  redirectUri: string;
  enabled: boolean;
  oauthConfig: IdpOauthConfig | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIdentityProviderDto {
  provider: IdpProvider;
  displayName: string;
  clientId: string;
  clientSecret?: string | null;
  redirectUri: string;
  enabled?: boolean;
  oauthConfig?: IdpOauthConfig | null;
}

export interface UpdateIdentityProviderDto {
  displayName?: string;
  clientId?: string;
  clientSecret?: string | null;
  redirectUri?: string;
  enabled?: boolean;
  oauthConfig?: IdpOauthConfig | null;
}
