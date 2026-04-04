import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  Matches,
} from 'class-validator';
import { Expose, Transform } from 'class-transformer';

export class CreatePermissionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @Matches(/^[a-zA-Z0-9_:.-]+$/, { message: 'code는 영문자, 숫자, _, :, ., - 만 허용됩니다' })
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  resource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9_:*]+$/, { message: 'action은 영문자, 숫자, _, :, * 만 허용됩니다' })
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;
}

export class UpdatePermissionDto {
  @IsOptional()
  @IsString()
  @MaxLength(256)
  resource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9_:*]+$/, { message: 'action은 영문자, 숫자, _, :, * 만 허용됩니다' })
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;
}

export class PermissionResponse {
  @Expose()
  id!: string;

  @Expose()
  code!: string;

  @Expose()
  resource?: string | null;

  @Expose()
  action?: string | null;

  @Expose()
  description?: string | null;

  @Expose()
  @Transform(({ value }) => (value instanceof Date ? value.toISOString() : value))
  createdAt!: Date;

  @Expose()
  @Transform(({ value }) => (value instanceof Date ? value.toISOString() : value))
  updatedAt!: Date;
}
