import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsUrl,
  MaxLength,
  MinLength,
  IsObject,
  ValidateNested,
  IsArray,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

/** 1–64자: 영숫자로 시작, 이후 영숫자·`_`·`-` (임의 OAuth/OIDC IdP 확장용) */
const IDP_PROVIDER_SLUG = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

const URL_OPTIONS = { require_tld: false } as const;

class IdpOauthConfigDto {
  @IsOptional()
  @IsUrl(URL_OPTIONS)
  authorizationUrl?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  tokenUrl?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  userinfoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsString()
  subField?: string;

  @IsOptional()
  @IsString()
  emailField?: string;

  @IsOptional()
  @IsObject()
  extraAuthParams?: Record<string, string>;
}

export class CreateIdentityProviderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(IDP_PROVIDER_SLUG, {
    message:
      'provider must be 1–64 chars, start with alphanumeric, then alphanumeric, underscore, or hyphen',
  })
  provider!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  displayName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  clientId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  clientSecret?: string | null;

  @IsString()
  @IsNotEmpty()
  @IsUrl(URL_OPTIONS)
  @MaxLength(255)
  redirectUri!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => IdpOauthConfigDto)
  oauthConfig?: IdpOauthConfigDto | null;
}

export class UpdateIdentityProviderDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  displayName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  clientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  clientSecret?: string | null;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(255)
  redirectUri?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => IdpOauthConfigDto)
  oauthConfig?: IdpOauthConfigDto | null;
}
