import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsIn,
  IsArray,
  IsUrl,
  MinLength,
  MaxLength,
  Matches,
  ArrayMaxSize,
  ValidateIf,
} from 'class-validator';
import { Expose, Transform } from 'class-transformer';

const CLIENT_TYPES = ['confidential', 'public', 'service'] as const;
const APPLICATION_TYPES = ['web', 'native'] as const;
const GRANT_TYPES = ['authorization_code', 'refresh_token', 'client_credentials', 'implicit'] as const;
const RESPONSE_TYPES = ['code', 'token', 'id_token'] as const;
const AUTH_METHODS = [
  'client_secret_basic',
  'client_secret_post',
  'private_key_jwt',
  'none',
] as const;

const URL_OPTIONS = { require_tld: false } as const;

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @Matches(/^[a-zA-Z0-9_.-]+$/, { message: 'clientId는 영문자, 숫자, _, ., - 만 허용됩니다' })
  clientId!: string;

  @IsOptional()
  @IsString()
  @MinLength(32)
  @MaxLength(256)
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
  @IsIn(GRANT_TYPES, { each: true })
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
  @IsBoolean()
  skipConsent?: boolean;
}

export class UpdateClientDto {
  @IsOptional()
  @ValidateIf((o) => o.secret !== null)
  @IsString()
  @MinLength(32)
  @MaxLength(256)
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
  @IsIn(GRANT_TYPES, { each: true })
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
  @IsBoolean()
  skipConsent?: boolean;
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
  skipConsent!: boolean;

  @Expose()
  @Transform(({ value }) => (value instanceof Date ? value.toISOString() : value))
  createdAt!: Date;

  @Expose()
  @Transform(({ value }) => (value instanceof Date ? value.toISOString() : value))
  updatedAt!: Date;
}
