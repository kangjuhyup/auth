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
  accessTokenTtlSec?: number | null;
  refreshTokenTtlSec?: number | null;
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
  accessTokenTtlSec?: number | null;
  refreshTokenTtlSec?: number | null;
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
  accessTokenTtlSec: number | null;
  refreshTokenTtlSec: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateClientAuthPolicyDto {
  allowedAuthMethods?: string[];
  defaultAcr?: string;
  mfaRequired?: boolean;
  allowedMfaMethods?: string[];
  maxSessionDurationSec?: number | null;
  consentRequired?: boolean;
  requireAuthTime?: boolean;
  allowedIdpProviderKeys?: string[] | null;
  reauthenticationIntervalSec?: number | null;
  refreshTokenRotationEnabled?: boolean;
  refreshTokenReuseAction?: 'revoke_grant';
}

export interface ClientAuthPolicyResponse {
  clientRefId: string;
  allowedAuthMethods: string[];
  defaultAcr: string;
  mfaRequired: boolean;
  allowedMfaMethods: string[];
  maxSessionDurationSec: number | null;
  consentRequired: boolean;
  requireAuthTime: boolean;
  allowedIdpProviderKeys: string[] | null;
  reauthenticationIntervalSec: number | null;
  refreshTokenRotationEnabled: boolean;
  refreshTokenReuseAction: 'revoke_grant';
  effective: {
    mfaRequired: boolean;
    allowedIdpProviderKeys: string[] | null;
    maxSessionDurationSec: number | null;
    requireAuthTime: boolean;
    reauthenticationIntervalSec: number | null;
    refreshTokenTtlSec: number;
  };
}
