export type ClientTypeInput = 'confidential' | 'public' | 'service';
export type ClientApplicationTypeInput = 'web' | 'native';

export class CreateClientDto {
  private constructor(
    public readonly clientId: string,
    public readonly name: string,
    public readonly secret?: string,
    public readonly type?: ClientTypeInput,
    public readonly redirectUris?: string[],
    public readonly grantTypes?: string[],
    public readonly responseTypes?: string[],
    public readonly tokenEndpointAuthMethod?: string,
    public readonly scope?: string,
    public readonly postLogoutRedirectUris?: string[],
    public readonly applicationType?: ClientApplicationTypeInput,
    public readonly backchannelLogoutUri?: string,
    public readonly frontchannelLogoutUri?: string,
    public readonly allowedResources?: string[],
    public readonly introspectionResources?: string[],
    public readonly skipConsent?: boolean,
    public readonly accessTokenTtlSec?: number | null,
    public readonly refreshTokenTtlSec?: number | null,
  ) {}

  static of(params: {
    clientId: string;
    secret?: string;
    name: string;
    type?: ClientTypeInput;
    redirectUris?: string[];
    grantTypes?: string[];
    responseTypes?: string[];
    tokenEndpointAuthMethod?: string;
    scope?: string;
    postLogoutRedirectUris?: string[];
    applicationType?: ClientApplicationTypeInput;
    backchannelLogoutUri?: string;
    frontchannelLogoutUri?: string;
    allowedResources?: string[];
    introspectionResources?: string[];
    skipConsent?: boolean;
    accessTokenTtlSec?: number | null;
    refreshTokenTtlSec?: number | null;
  }): CreateClientDto {
    return new CreateClientDto(
      params.clientId,
      params.name,
      params.secret,
      params.type,
      params.redirectUris,
      params.grantTypes,
      params.responseTypes,
      params.tokenEndpointAuthMethod,
      params.scope,
      params.postLogoutRedirectUris,
      params.applicationType,
      params.backchannelLogoutUri,
      params.frontchannelLogoutUri,
      params.allowedResources,
      params.introspectionResources,
      params.skipConsent,
      params.accessTokenTtlSec,
      params.refreshTokenTtlSec,
    );
  }
}

export class UpdateClientDto {
  private constructor(
    public readonly secret?: string | null,
    public readonly name?: string,
    public readonly enabled?: boolean,
    public readonly redirectUris?: string[],
    public readonly grantTypes?: string[],
    public readonly responseTypes?: string[],
    public readonly tokenEndpointAuthMethod?: string,
    public readonly scope?: string,
    public readonly postLogoutRedirectUris?: string[],
    public readonly applicationType?: ClientApplicationTypeInput,
    public readonly backchannelLogoutUri?: string | null,
    public readonly frontchannelLogoutUri?: string | null,
    public readonly allowedResources?: string[],
    public readonly introspectionResources?: string[],
    public readonly skipConsent?: boolean,
    public readonly accessTokenTtlSec?: number | null,
    public readonly refreshTokenTtlSec?: number | null,
  ) {}

  static of(params: {
    secret?: string | null;
    name?: string;
    enabled?: boolean;
    redirectUris?: string[];
    grantTypes?: string[];
    responseTypes?: string[];
    tokenEndpointAuthMethod?: string;
    scope?: string;
    postLogoutRedirectUris?: string[];
    applicationType?: ClientApplicationTypeInput;
    backchannelLogoutUri?: string | null;
    frontchannelLogoutUri?: string | null;
    allowedResources?: string[];
    introspectionResources?: string[];
    skipConsent?: boolean;
    accessTokenTtlSec?: number | null;
    refreshTokenTtlSec?: number | null;
  }): UpdateClientDto {
    return new UpdateClientDto(
      params.secret,
      params.name,
      params.enabled,
      params.redirectUris,
      params.grantTypes,
      params.responseTypes,
      params.tokenEndpointAuthMethod,
      params.scope,
      params.postLogoutRedirectUris,
      params.applicationType,
      params.backchannelLogoutUri,
      params.frontchannelLogoutUri,
      params.allowedResources,
      params.introspectionResources,
      params.skipConsent,
      params.accessTokenTtlSec,
      params.refreshTokenTtlSec,
    );
  }
}

export class ClientResponse {
  private constructor(
    public readonly id: string,
    public readonly clientId: string,
    public readonly name: string,
    public readonly type: string,
    public readonly enabled: boolean,
    public readonly redirectUris: string[],
    public readonly grantTypes: string[],
    public readonly responseTypes: string[],
    public readonly tokenEndpointAuthMethod: string,
    public readonly scope: string,
    public readonly postLogoutRedirectUris: string[],
    public readonly applicationType: string,
    public readonly backchannelLogoutUri: string | null,
    public readonly frontchannelLogoutUri: string | null,
    public readonly allowedResources: string[],
    public readonly introspectionResources: string[],
    public readonly skipConsent: boolean,
    public readonly accessTokenTtlSec: number | null,
    public readonly refreshTokenTtlSec: number | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static of(params: {
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
    introspectionResources: string[];
    skipConsent: boolean;
    accessTokenTtlSec: number | null;
    refreshTokenTtlSec: number | null;
    createdAt: Date;
    updatedAt: Date;
  }): ClientResponse {
    return new ClientResponse(
      params.id,
      params.clientId,
      params.name,
      params.type,
      params.enabled,
      params.redirectUris,
      params.grantTypes,
      params.responseTypes,
      params.tokenEndpointAuthMethod,
      params.scope,
      params.postLogoutRedirectUris,
      params.applicationType,
      params.backchannelLogoutUri,
      params.frontchannelLogoutUri,
      params.allowedResources,
      params.introspectionResources,
      params.skipConsent,
      params.accessTokenTtlSec,
      params.refreshTokenTtlSec,
      params.createdAt,
      params.updatedAt,
    );
  }
}

export class UpdateClientAuthPolicyDto {
  private constructor(
    public readonly allowedAuthMethods?: string[],
    public readonly defaultAcr?: string,
    public readonly mfaRequired?: boolean,
    public readonly allowedMfaMethods?: string[],
    public readonly maxSessionDurationSec?: number | null,
    public readonly consentRequired?: boolean,
    public readonly requireAuthTime?: boolean,
    public readonly allowedIdpProviderKeys?: string[] | null,
    public readonly reauthenticationIntervalSec?: number | null,
    public readonly refreshTokenRotationEnabled?: boolean,
    public readonly refreshTokenReuseAction?: 'revoke_grant',
    public readonly loginSessionMode?: 'single' | null,
    public readonly maxConcurrentSessions?: number | null,
    public readonly sessionConflictAction?:
      | 'deny_new_login'
      | 'revoke_previous_sessions'
      | 'revoke_oldest_session'
      | null,
  ) {}

  static of(params: {
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
  }): UpdateClientAuthPolicyDto {
    return new UpdateClientAuthPolicyDto(
      params.allowedAuthMethods,
      params.defaultAcr,
      params.mfaRequired,
      params.allowedMfaMethods,
      params.maxSessionDurationSec,
      params.consentRequired,
      params.requireAuthTime,
      params.allowedIdpProviderKeys,
      params.reauthenticationIntervalSec,
      params.refreshTokenRotationEnabled,
      params.refreshTokenReuseAction,
      params.loginSessionMode,
      params.maxConcurrentSessions,
      params.sessionConflictAction,
    );
  }
}

export class ClientAuthPolicyEffectiveResponse {
  private constructor(
    public readonly mfaRequired: boolean,
    public readonly allowedIdpProviderKeys: string[] | null,
    public readonly maxSessionDurationSec: number | null,
    public readonly requireAuthTime: boolean,
    public readonly reauthenticationIntervalSec: number | null,
    public readonly refreshTokenTtlSec: number,
    public readonly loginSessionMode: 'multi' | 'single',
    public readonly maxConcurrentSessions: number | null,
    public readonly sessionConflictAction:
      | 'deny_new_login'
      | 'revoke_previous_sessions'
      | 'revoke_oldest_session',
  ) {}

  static of(params: {
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
  }): ClientAuthPolicyEffectiveResponse {
    return new ClientAuthPolicyEffectiveResponse(
      params.mfaRequired,
      params.allowedIdpProviderKeys,
      params.maxSessionDurationSec,
      params.requireAuthTime,
      params.reauthenticationIntervalSec,
      params.refreshTokenTtlSec,
      params.loginSessionMode,
      params.maxConcurrentSessions,
      params.sessionConflictAction,
    );
  }
}

export class ClientAuthPolicyResponse {
  private constructor(
    public readonly clientRefId: string,
    public readonly allowedAuthMethods: string[],
    public readonly defaultAcr: string,
    public readonly mfaRequired: boolean,
    public readonly allowedMfaMethods: string[],
    public readonly maxSessionDurationSec: number | null,
    public readonly consentRequired: boolean,
    public readonly requireAuthTime: boolean,
    public readonly allowedIdpProviderKeys: string[] | null,
    public readonly reauthenticationIntervalSec: number | null,
    public readonly refreshTokenRotationEnabled: boolean,
    public readonly refreshTokenReuseAction: 'revoke_grant',
    public readonly loginSessionMode: 'single' | null,
    public readonly maxConcurrentSessions: number | null,
    public readonly sessionConflictAction:
      | 'deny_new_login'
      | 'revoke_previous_sessions'
      | 'revoke_oldest_session'
      | null,
    public readonly effective: ClientAuthPolicyEffectiveResponse,
  ) {}

  static of(params: {
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
    effective: ClientAuthPolicyEffectiveResponse;
  }): ClientAuthPolicyResponse {
    return new ClientAuthPolicyResponse(
      params.clientRefId,
      params.allowedAuthMethods,
      params.defaultAcr,
      params.mfaRequired,
      params.allowedMfaMethods,
      params.maxSessionDurationSec,
      params.consentRequired,
      params.requireAuthTime,
      params.allowedIdpProviderKeys,
      params.reauthenticationIntervalSec,
      params.refreshTokenRotationEnabled,
      params.refreshTokenReuseAction,
      params.loginSessionMode,
      params.maxConcurrentSessions,
      params.sessionConflictAction,
      params.effective,
    );
  }
}
