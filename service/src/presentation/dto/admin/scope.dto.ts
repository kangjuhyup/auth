import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Expose, Transform } from 'class-transformer';

const SCOPE_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/;

export class CreateScopeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @Matches(SCOPE_NAME_PATTERN, {
    message: 'name은 영문자, 숫자로 시작하고 _, ., :, - 만 허용됩니다',
  })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  claimKeys?: string[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateScopeDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  claimKeys?: string[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class ScopeResponse {
  @Expose()
  id!: string;

  @Expose()
  name!: string;

  @Expose()
  displayName!: string;

  @Expose()
  description!: string | null;

  @Expose()
  claimKeys!: string[];

  @Expose()
  enabled!: boolean;

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
