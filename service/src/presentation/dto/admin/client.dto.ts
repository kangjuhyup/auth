import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsIn,
  IsArray,
  IsUrl,
  IsInt,
  MinLength,
  MaxLength,
  Min,
  Max,
  Matches,
  ArrayMaxSize,
  ValidateIf,
} from 'class-validator';
import { Expose, Transform } from 'class-transformer';
import { MaskLog } from '@kangjuhyup/rvlog';

const CLIENT_TYPES = ['confidential', 'public', 'service'] as const;
const APPLICATION_TYPES = ['web', 'native'] as const;
const GRANT_TYPES = [
  'authorization_code',
  'refresh_token',
  'client_credentials',
  'implicit',
] as const;
const GRANT_TYPE_PATTERN = new RegExp(
  `^(${GRANT_TYPES.join('|')}|urn:[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,255})$`,
);
const RESPONSE_TYPES = ['code', 'token', 'id_token'] as const;
const AUTH_METHODS = [
  'client_secret_basic',
  'client_secret_post',
  'private_key_jwt',
  'none',
] as const;
const USER_AUTH_METHODS = [
  'password',
  'totp',
  'webauthn',
  'magic_link',
] as const;
const MFA_METHODS = ['totp', 'webauthn', 'recovery_code'] as const;
const REFRESH_TOKEN_REUSE_ACTIONS = ['revoke_grant'] as const;

const URL_OPTIONS = { require_tld: false } as const;

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message: 'clientId는 영문자, 숫자, _, ., - 만 허용됩니다',
  })
  clientId!: string;

  @IsOptional()
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  @MaskLog({ type: 'full' })
  secret?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name!: string;

  @IsOptional()
  @IsIn(CLIENT_TYPES)
  type?: 'confidential' | 'public' | 'service';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUrl(URL_OPTIONS, { each: true })
  redirectUris?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Matches(GRANT_TYPE_PATTERN, {
    each: true,
    message:
      'grantTypes는 내장 grant 또는 urn:... 형식의 커스텀 grant만 허용됩니다',
  })
  grantTypes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsIn(RESPONSE_TYPES, { each: true })
  responseTypes?: string[];

  @IsOptional()
  @IsIn(AUTH_METHODS)
  tokenEndpointAuthMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  scope?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUrl(URL_OPTIONS, { each: true })
  postLogoutRedirectUris?: string[];

  @IsOptional()
  @IsIn(APPLICATION_TYPES)
  applicationType?: 'web' | 'native';

  @IsOptional()
  @IsUrl({ protocols: ['https'] })
  backchannelLogoutUri?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'] })
  frontchannelLogoutUri?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUrl({ protocols: ['https'] }, { each: true })
  allowedResources?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUrl({ protocols: ['https'], require_protocol: true }, { each: true })
  @Matches(/^https:\/\//, { each: true })
  introspectionResources?: string[];

  @IsOptional()
  @IsBoolean()
  skipConsent?: boolean;

  @IsOptional()
  @ValidateIf((o) => o.accessTokenTtlSec !== null)
  @IsInt()
  @Min(60)
  accessTokenTtlSec?: number | null;

  @IsOptional()
  @ValidateIf((o) => o.refreshTokenTtlSec !== null)
  @IsInt()
  @Min(60)
  refreshTokenTtlSec?: number | null;
}

export class UpdateClientDto {
  @IsOptional()
  @ValidateIf((o) => o.secret !== null)
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  @MaskLog({ type: 'full' })
  secret?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUrl(URL_OPTIONS, { each: true })
  redirectUris?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Matches(GRANT_TYPE_PATTERN, {
    each: true,
    message:
      'grantTypes는 내장 grant 또는 urn:... 형식의 커스텀 grant만 허용됩니다',
  })
  grantTypes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsIn(RESPONSE_TYPES, { each: true })
  responseTypes?: string[];

  @IsOptional()
  @IsIn(AUTH_METHODS)
  tokenEndpointAuthMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  scope?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUrl(URL_OPTIONS, { each: true })
  postLogoutRedirectUris?: string[];

  @IsOptional()
  @IsIn(APPLICATION_TYPES)
  applicationType?: 'web' | 'native';

  @IsOptional()
  @ValidateIf((o) => o.backchannelLogoutUri !== null)
  @IsUrl({ protocols: ['https'] })
  backchannelLogoutUri?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.frontchannelLogoutUri !== null)
  @IsUrl({ protocols: ['https'] })
  frontchannelLogoutUri?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUrl({ protocols: ['https'] }, { each: true })
  allowedResources?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUrl({ protocols: ['https'], require_protocol: true }, { each: true })
  @Matches(/^https:\/\//, { each: true })
  introspectionResources?: string[];

  @IsOptional()
  @IsBoolean()
  skipConsent?: boolean;

  @IsOptional()
  @ValidateIf((o) => o.accessTokenTtlSec !== null)
  @IsInt()
  @Min(60)
  accessTokenTtlSec?: number | null;

  @IsOptional()
  @ValidateIf((o) => o.refreshTokenTtlSec !== null)
  @IsInt()
  @Min(60)
  refreshTokenTtlSec?: number | null;
}

export class UpdateClientAuthPolicyDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsIn(USER_AUTH_METHODS, { each: true })
  allowedAuthMethods?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(128)
  defaultAcr?: string;

  @IsOptional()
  @IsBoolean()
  mfaRequired?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsIn(MFA_METHODS, { each: true })
  allowedMfaMethods?: string[];

  @IsOptional()
  @ValidateIf((o) => o.maxSessionDurationSec !== null)
  @IsInt()
  @Min(60)
  maxSessionDurationSec?: number | null;

  @IsOptional()
  @IsBoolean()
  consentRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  requireAuthTime?: boolean;

  @IsOptional()
  @ValidateIf((o) => o.allowedIdpProviderKeys !== null)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  @Matches(/^[a-zA-Z0-9_.:-]+$/, {
    each: true,
    message: 'allowedIdpProviderKeys는 영문자, 숫자, _, ., :, - 만 허용됩니다',
  })
  allowedIdpProviderKeys?: string[] | null;

  @IsOptional()
  @ValidateIf((o) => o.reauthenticationIntervalSec !== null)
  @IsInt()
  @Min(60)
  reauthenticationIntervalSec?: number | null;

  @IsOptional()
  @IsBoolean()
  refreshTokenRotationEnabled?: boolean;

  @IsOptional()
  @IsIn(REFRESH_TOKEN_REUSE_ACTIONS)
  refreshTokenReuseAction?: 'revoke_grant';

  @IsOptional()
  @ValidateIf((o) => o.loginSessionMode !== null)
  @IsIn(['single'])
  loginSessionMode?: 'single' | null;

  @IsOptional()
  @ValidateIf((o) => o.maxConcurrentSessions !== null)
  @IsInt()
  @Min(1)
  @Max(100)
  maxConcurrentSessions?: number | null;

  @IsOptional()
  @ValidateIf((o) => o.sessionConflictAction !== null)
  @IsIn(['deny_new_login', 'revoke_previous_sessions', 'revoke_oldest_session'])
  sessionConflictAction?:
    | 'deny_new_login'
    | 'revoke_previous_sessions'
    | 'revoke_oldest_session'
    | null;
}

export class ClientResponse {
  @Expose()
  id!: string;

  @Expose()
  clientId!: string;

  @Expose()
  name!: string;

  @Expose()
  type!: string;

  @Expose()
  enabled!: boolean;

  @Expose()
  redirectUris!: string[];

  @Expose()
  grantTypes!: string[];

  @Expose()
  responseTypes!: string[];

  @Expose()
  tokenEndpointAuthMethod!: string;

  @Expose()
  scope!: string;

  @Expose()
  postLogoutRedirectUris!: string[];

  @Expose()
  applicationType!: string;

  @Expose()
  backchannelLogoutUri!: string | null;

  @Expose()
  frontchannelLogoutUri!: string | null;

  @Expose()
  allowedResources!: string[];

  @Expose()
  introspectionResources!: string[];

  @Expose()
  skipConsent!: boolean;

  @Expose()
  accessTokenTtlSec!: number | null;

  @Expose()
  refreshTokenTtlSec!: number | null;

  @Expose()
  @Transform(({ value }) =>
    value instanceof Date ? value.toISOString() : value,
  )
  createdAt!: Date;

  @Expose()
  @Transform(({ value }) =>
    value instanceof Date ? value.toISOString() : value,
  )
  updatedAt!: Date;
}

export class ClientAuthPolicyResponse {
  @Expose()
  clientRefId!: string;

  @Expose()
  allowedAuthMethods!: string[];

  @Expose()
  defaultAcr!: string;

  @Expose()
  mfaRequired!: boolean;

  @Expose()
  allowedMfaMethods!: string[];

  @Expose()
  maxSessionDurationSec!: number | null;

  @Expose()
  consentRequired!: boolean;

  @Expose()
  requireAuthTime!: boolean;

  @Expose()
  allowedIdpProviderKeys!: string[] | null;

  @Expose()
  reauthenticationIntervalSec!: number | null;

  @Expose()
  refreshTokenRotationEnabled!: boolean;

  @Expose()
  refreshTokenReuseAction!: 'revoke_grant';

  @Expose()
  loginSessionMode!: 'single' | null;

  @Expose()
  maxConcurrentSessions!: number | null;

  @Expose()
  sessionConflictAction!:
    | 'deny_new_login'
    | 'revoke_previous_sessions'
    | 'revoke_oldest_session'
    | null;

  @Expose()
  effective!: {
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
