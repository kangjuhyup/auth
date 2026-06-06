import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsIn,
  IsBoolean,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Expose, Transform } from 'class-transformer';
import { MaskLog } from '@kangjuhyup/rvlog';
import { PaginationQuery } from '../common/pagination.dto';

const USER_STATUSES = ['ACTIVE', 'LOCKED', 'DISABLED'] as const;

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message: 'username은 영문자, 숫자, _, ., - 만 허용됩니다',
  })
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  @MaskLog({ type: 'full' })
  password!: string;

  @IsOptional()
  @IsBoolean()
  temporaryPassword?: boolean;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  @MaskLog({ type: 'email' })
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: '유효하지 않은 전화번호 형식입니다' })
  @MaskLog({ type: 'phone' })
  phone?: string;

  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: 'ACTIVE' | 'LOCKED' | 'DISABLED';
}

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  @MaskLog({ type: 'email' })
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: '유효하지 않은 전화번호 형식입니다' })
  @MaskLog({ type: 'phone' })
  phone?: string;

  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: 'ACTIVE' | 'LOCKED' | 'DISABLED';

  @IsOptional()
  @IsBoolean()
  mfaEnabled?: boolean;
}

export class UserListQuery extends PaginationQuery {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  search?: string;
}

export class UserResponse {
  @Expose()
  id!: string;

  @Expose()
  username!: string;

  @Expose()
  email?: string | null;

  @Expose()
  emailVerified!: boolean;

  @Expose()
  phone?: string | null;

  @Expose()
  phoneVerified!: boolean;

  @Expose()
  status!: string;

  @Expose()
  mfaEnabled!: boolean;

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

export class UserSessionResponse {
  @Expose()
  sessionId!: string;

  @Expose()
  userId!: string;

  @Expose()
  clientId!: string;

  @Expose()
  @Transform(({ value }) =>
    value instanceof Date ? value.toISOString() : value,
  )
  createdAt!: Date;

  @Expose()
  @Transform(({ value }) =>
    value instanceof Date ? value.toISOString() : value,
  )
  expiresAt?: Date | null;
}

export class UserConsentResponse {
  @Expose()
  id!: string;

  @Expose()
  userId!: string;

  @Expose()
  clientRefId!: string;

  @Expose()
  clientId!: string;

  @Expose()
  clientName!: string;

  @Expose()
  grantedScopes!: string;

  @Expose()
  @Transform(({ value }) =>
    value instanceof Date ? value.toISOString() : value,
  )
  grantedAt!: Date;

  @Expose()
  @Transform(({ value }) =>
    value instanceof Date ? value.toISOString() : value,
  )
  revokedAt?: Date | null;

  @Expose()
  status!: 'ACTIVE' | 'REVOKED';
}
