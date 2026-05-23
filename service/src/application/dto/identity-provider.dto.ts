import type {
  IdpOauthEndpointsConfig,
  IdpProtocol,
  IdpProvider,
  IdpSamlConfig,
} from '@domain/models/identity-provider';

export interface CreateIdentityProviderDto {
  provider: IdpProvider;
  protocol?: IdpProtocol;
  displayName: string;
  clientId: string;
  clientSecret?: string | null;
  redirectUri: string;
  enabled?: boolean;
  oauthConfig?: IdpOauthEndpointsConfig | null;
  samlConfig?: IdpSamlConfig | null;
}

export interface UpdateIdentityProviderDto {
  protocol?: IdpProtocol;
  displayName?: string;
  clientId?: string;
  clientSecret?: string | null;
  redirectUri?: string;
  enabled?: boolean;
  oauthConfig?: IdpOauthEndpointsConfig | null;
  samlConfig?: IdpSamlConfig | null;
}

export interface IdentityProviderResponse {
  id: string;
  provider: IdpProvider;
  protocol: IdpProtocol;
  displayName: string;
  clientId: string;
  /** 비밀번호는 응답에 포함하지 않고 설정 여부만 전달 */
  clientSecretSet: boolean;
  redirectUri: string;
  enabled: boolean;
  oauthConfig: IdpOauthEndpointsConfig | null;
  samlConfig: IdpSamlConfig | null;
  createdAt: Date;
  updatedAt: Date;
}
