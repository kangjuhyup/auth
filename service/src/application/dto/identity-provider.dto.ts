import type { IdpOauthEndpointsConfig, IdpProvider } from '@domain/models/identity-provider';

export interface CreateIdentityProviderDto {
  provider: IdpProvider;
  displayName: string;
  clientId: string;
  clientSecret?: string | null;
  redirectUri: string;
  enabled?: boolean;
  oauthConfig?: IdpOauthEndpointsConfig | null;
}

export interface UpdateIdentityProviderDto {
  displayName?: string;
  clientId?: string;
  clientSecret?: string | null;
  redirectUri?: string;
  enabled?: boolean;
  oauthConfig?: IdpOauthEndpointsConfig | null;
}

export interface IdentityProviderResponse {
  id: string;
  provider: IdpProvider;
  displayName: string;
  clientId: string;
  /** 비밀번호는 응답에 포함하지 않고 설정 여부만 전달 */
  clientSecretSet: boolean;
  redirectUri: string;
  enabled: boolean;
  oauthConfig: IdpOauthEndpointsConfig | null;
  createdAt: Date;
  updatedAt: Date;
}
