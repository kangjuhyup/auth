import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsIn,
  MaxLength,
  Matches,
} from 'class-validator';
import { Expose, Transform } from 'class-transformer';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(/^[a-z0-9-]+$/, { message: 'code는 소문자 영문자, 숫자, - 만 허용됩니다' })
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name!: string;

  @IsOptional()
  @IsIn(['invite', 'open'])
  signupPolicy?: 'invite' | 'open';

  @IsOptional()
  @IsBoolean()
  requirePhoneVerify?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  brandName?: string;
}

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsIn(['invite', 'open'])
  signupPolicy?: 'invite' | 'open';

  @IsOptional()
  @IsBoolean()
  requirePhoneVerify?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  brandName?: string;
}

export class TenantResponse {
  @Expose()
  id!: string;

  @Expose()
  code!: string;

  @Expose()
  name!: string;

  @Expose()
  signupPolicy!: string;

  @Expose()
  requirePhoneVerify!: boolean;

  @Expose()
  brandName?: string | null;

  @Expose()
  @Transform(({ value }) => (value instanceof Date ? value.toISOString() : value))
  createdAt!: Date;

  @Expose()
  @Transform(({ value }) => (value instanceof Date ? value.toISOString() : value))
  updatedAt!: Date;
}
