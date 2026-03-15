export class CreateClientDto {
  clientId!: string;
  secret?: string;
  name!: string;
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
}

export class UpdateClientDto {
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
}

export class ClientResponse {
  id!: string;
  clientId!: string;
  name!: string;
  type!: string;
  enabled!: boolean;
  redirectUris!: string[];
  grantTypes!: string[];
  responseTypes!: string[];
  tokenEndpointAuthMethod!: string;
  scope!: string;
  postLogoutRedirectUris!: string[];
  applicationType!: string;
  backchannelLogoutUri!: string | null;
  frontchannelLogoutUri!: string | null;
  allowedResources!: string[];
  createdAt!: Date;
  updatedAt!: Date;
}
