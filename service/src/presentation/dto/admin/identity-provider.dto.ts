import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsIn,
  IsUrl,
  MaxLength,
  MinLength,
  IsObject,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

const IDP_PROVIDERS = ['kakao', 'naver', 'google', 'apple'] as const;

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
  @IsIn(IDP_PROVIDERS)
  provider!: (typeof IDP_PROVIDERS)[number];

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
