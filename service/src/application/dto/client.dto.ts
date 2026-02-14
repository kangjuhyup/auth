export class CreateClientDto {
  clientId!: string;
  name!: string;
  type?: 'confidential' | 'public' | 'service';
  redirectUris?: string[];
  grantTypes?: string[];
  responseTypes?: string[];
  tokenEndpointAuthMethod?: string;
  scope?: string;
  postLogoutRedirectUris?: string[];
}

export class UpdateClientDto {
  name?: string;
  enabled?: boolean;
  redirectUris?: string[];
  grantTypes?: string[];
  responseTypes?: string[];
  tokenEndpointAuthMethod?: string;
  scope?: string;
  postLogoutRedirectUris?: string[];
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
  createdAt!: Date;
  updatedAt!: Date;
}
