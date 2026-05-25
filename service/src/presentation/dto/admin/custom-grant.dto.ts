import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Expose, Transform } from 'class-transformer';
import type { ApplicationType, ClientType } from '@domain/models/client';

const CUSTOM_GRANT_TYPE_PATTERN = /^urn:[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,187}$/;
const CLIENT_TYPES: ClientType[] = ['confidential', 'public', 'service'];
const APPLICATION_TYPES: ApplicationType[] = ['web', 'native'];

export class CreateCustomGrantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(192)
  @Matches(CUSTOM_GRANT_TYPE_PATTERN, {
    message: 'grantType은 urn: 으로 시작하는 커스텀 grant 형식이어야 합니다',
  })
  grantType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(CLIENT_TYPES, { each: true })
  allowedClientTypes?: ClientType[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(APPLICATION_TYPES, { each: true })
  allowedApplicationTypes?: ApplicationType[];

  @IsOptional()
  @IsBoolean()
  requiresClientAuthentication?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(192, { each: true })
  requiresGrantTypes?: string[];
}

export class UpdateCustomGrantDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(CLIENT_TYPES, { each: true })
  allowedClientTypes?: ClientType[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(APPLICATION_TYPES, { each: true })
  allowedApplicationTypes?: ApplicationType[];

  @IsOptional()
  @IsBoolean()
  requiresClientAuthentication?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(192, { each: true })
  requiresGrantTypes?: string[];
}

export class CustomGrantResponse {
  @Expose()
  id!: string;

  @Expose()
  grantType!: string;

  @Expose()
  displayName!: string;

  @Expose()
  description!: string | null;

  @Expose()
  enabled!: boolean;

  @Expose()
  allowedClientTypes!: ClientType[];

  @Expose()
  allowedApplicationTypes!: ApplicationType[];

  @Expose()
  requiresClientAuthentication!: boolean;

  @Expose()
  requiresGrantTypes!: string[];

  @Expose()
  builtIn!: boolean;

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
