export interface CreateClientDto {
  clientId: string;
  secret?: string;
  name: string;
  type?: 'confidential' | 'public' | 'service';
  redirectUris?: string[];
  grantTypes?: string[];
  responseTypes?: string[];
  tokenEndpointAuthMethod?: string;
  scope?: string;
  postLogoutRedirectUris?: string[];
  applicationType?: 'web' | 'native';
  backchannelLogoutUri?: string;
  frontchannelLogoutUri?: string;
  allowedResources?: string[];
  skipConsent?: boolean;
}

export interface UpdateClientDto {
  secret?: string | null;
  name?: string;
  enabled?: boolean;
  redirectUris?: string[];
  grantTypes?: string[];
  responseTypes?: string[];
  tokenEndpointAuthMethod?: string;
  scope?: string;
  postLogoutRedirectUris?: string[];
  applicationType?: 'web' | 'native';
  backchannelLogoutUri?: string | null;
  frontchannelLogoutUri?: string | null;
  allowedResources?: string[];
  skipConsent?: boolean;
}

export interface ClientResponse {
  id: string;
  clientId: string;
  name: string;
  type: string;
  enabled: boolean;
  redirectUris: string[];
  grantTypes: string[];
  responseTypes: string[];
  tokenEndpointAuthMethod: string;
  scope: string;
  postLogoutRedirectUris: string[];
  applicationType: string;
  backchannelLogoutUri: string | null;
  frontchannelLogoutUri: string | null;
  allowedResources: string[];
  skipConsent: boolean;
  createdAt: Date;
  updatedAt: Date;
}
