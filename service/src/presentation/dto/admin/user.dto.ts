import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsIn,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Expose, Transform } from 'class-transformer';

const USER_STATUSES = ['ACTIVE', 'LOCKED', 'DISABLED'] as const;

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9_.-]+$/, { message: 'username은 영문자, 숫자, _, ., - 만 허용됩니다' })
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: '유효하지 않은 전화번호 형식입니다' })
  phone?: string;

  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: 'ACTIVE' | 'LOCKED' | 'DISABLED';
}

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: '유효하지 않은 전화번호 형식입니다' })
  phone?: string;

  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: 'ACTIVE' | 'LOCKED' | 'DISABLED';
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
  @Transform(({ value }) => (value instanceof Date ? value.toISOString() : value))
  createdAt!: Date;

  @Expose()
  @Transform(({ value }) => (value instanceof Date ? value.toISOString() : value))
  updatedAt!: Date;
}
