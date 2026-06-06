import type {
  IdpOauthEndpointsConfig,
  IdpProtocol,
  IdpProvider,
  IdpSamlConfig,
} from '@domain/models/identity-provider';

export class CreateIdentityProviderDto {
  private constructor(
    public readonly provider: IdpProvider,
    public readonly displayName: string,
    public readonly clientId: string,
    public readonly redirectUri: string,
    public readonly protocol?: IdpProtocol,
    public readonly clientSecret?: string | null,
    public readonly enabled?: boolean,
    public readonly oauthConfig?: IdpOauthEndpointsConfig | null,
    public readonly samlConfig?: IdpSamlConfig | null,
  ) {}

  static of(params: {
    provider: IdpProvider;
    protocol?: IdpProtocol;
    displayName: string;
    clientId: string;
    clientSecret?: string | null;
    redirectUri: string;
    enabled?: boolean;
    oauthConfig?: IdpOauthEndpointsConfig | null;
    samlConfig?: IdpSamlConfig | null;
  }): CreateIdentityProviderDto {
    return new CreateIdentityProviderDto(
      params.provider,
      params.displayName,
      params.clientId,
      params.redirectUri,
      params.protocol,
      params.clientSecret,
      params.enabled,
      params.oauthConfig,
      params.samlConfig,
    );
  }
}

export class UpdateIdentityProviderDto {
  private constructor(
    public readonly protocol?: IdpProtocol,
    public readonly displayName?: string,
    public readonly clientId?: string,
    public readonly clientSecret?: string | null,
    public readonly redirectUri?: string,
    public readonly enabled?: boolean,
    public readonly oauthConfig?: IdpOauthEndpointsConfig | null,
    public readonly samlConfig?: IdpSamlConfig | null,
  ) {}

  static of(params: {
    protocol?: IdpProtocol;
    displayName?: string;
    clientId?: string;
    clientSecret?: string | null;
    redirectUri?: string;
    enabled?: boolean;
    oauthConfig?: IdpOauthEndpointsConfig | null;
    samlConfig?: IdpSamlConfig | null;
  }): UpdateIdentityProviderDto {
    return new UpdateIdentityProviderDto(
      params.protocol,
      params.displayName,
      params.clientId,
      params.clientSecret,
      params.redirectUri,
      params.enabled,
      params.oauthConfig,
      params.samlConfig,
    );
  }
}

export class IdentityProviderResponse {
  private constructor(
    public readonly id: string,
    public readonly provider: IdpProvider,
    public readonly protocol: IdpProtocol,
    public readonly displayName: string,
    public readonly clientId: string,
    public readonly clientSecretSet: boolean,
    public readonly redirectUri: string,
    public readonly enabled: boolean,
    public readonly oauthConfig: IdpOauthEndpointsConfig | null,
    public readonly samlConfig: IdpSamlConfig | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static of(params: {
    id: string;
    provider: IdpProvider;
    protocol: IdpProtocol;
    displayName: string;
    clientId: string;
    clientSecretSet: boolean;
    redirectUri: string;
    enabled: boolean;
    oauthConfig: IdpOauthEndpointsConfig | null;
    samlConfig: IdpSamlConfig | null;
    createdAt: Date;
    updatedAt: Date;
  }): IdentityProviderResponse {
    return new IdentityProviderResponse(
      params.id,
      params.provider,
      params.protocol,
      params.displayName,
      params.clientId,
      params.clientSecretSet,
      params.redirectUri,
      params.enabled,
      params.oauthConfig,
      params.samlConfig,
      params.createdAt,
      params.updatedAt,
    );
  }
}
