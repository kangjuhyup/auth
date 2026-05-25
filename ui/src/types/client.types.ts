export interface CreateClientDto {
  clientId: string;
  name: string;
  type?: 'confidential' | 'public' | 'service';
  redirectUris?: string[];
  grantTypes?: string[];
  responseTypes?: string[];
  tokenEndpointAuthMethod?: string;
  scope?: string;
  postLogoutRedirectUris?: string[];
}

export interface UpdateClientDto {
  name?: string;
  enabled?: boolean;
  redirectUris?: string[];
  grantTypes?: string[];
  responseTypes?: string[];
  tokenEndpointAuthMethod?: string;
  scope?: string;
  postLogoutRedirectUris?: string[];
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
  loginSessionMode?: 'single' | null;
  maxConcurrentSessions?: number | null;
  sessionConflictAction?:
    | 'deny_new_login'
    | 'revoke_previous_sessions'
    | 'revoke_oldest_session'
    | null;
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
  loginSessionMode: 'single' | null;
  maxConcurrentSessions: number | null;
  sessionConflictAction:
    | 'deny_new_login'
    | 'revoke_previous_sessions'
    | 'revoke_oldest_session'
    | null;
  effective: {
    mfaRequired: boolean;
    allowedIdpProviderKeys: string[] | null;
    maxSessionDurationSec: number | null;
    requireAuthTime: boolean;
    reauthenticationIntervalSec: number | null;
    refreshTokenTtlSec: number;
    loginSessionMode: 'multi' | 'single';
    maxConcurrentSessions: number | null;
    sessionConflictAction:
      | 'deny_new_login'
      | 'revoke_previous_sessions'
      | 'revoke_oldest_session';
  };
}
