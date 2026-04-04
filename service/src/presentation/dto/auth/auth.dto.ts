import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
} from 'class-validator';
import { Transform, Expose } from 'class-transformer';

export class SignupDto {
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
}

export class WithdrawDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class PasswordResetRequestDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: '유효하지 않은 전화번호 형식입니다' })
  phone?: string;
}

export class PasswordResetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: '유효하지 않은 전화번호 형식입니다' })
  phone?: string;
}

export class ProfileResponse {
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
  createdAt?: Date;

  @Expose()
  @Transform(({ value }) => (value instanceof Date ? value.toISOString() : value))
  updatedAt?: Date;
}

export class ConsentResponse {
  @Expose()
  clientId!: string;

  @Expose()
  clientName!: string;

  @Expose()
  grantedScopes!: string;

  @Expose()
  @Transform(({ value }) => (value instanceof Date ? value.toISOString() : value))
  grantedAt!: Date;
}
