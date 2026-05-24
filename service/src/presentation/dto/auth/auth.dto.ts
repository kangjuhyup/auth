import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  MinLength,
  MaxLength,
  Matches,
  IsNotEmpty,
} from 'class-validator';
import { Transform, Expose } from 'class-transformer';
import { MaskLog } from '@kangjuhyup/rvlog';

export class SignupDto {
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
  @IsEmail()
  @MaxLength(254)
  @MaskLog({ type: 'email' })
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: '유효하지 않은 전화번호 형식입니다' })
  @MaskLog({ type: 'phone' })
  phone?: string;
}

export class WithdrawDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  @MaskLog({ type: 'full' })
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  @MaskLog({ type: 'full' })
  currentPassword!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  @MaskLog({ type: 'full' })
  newPassword!: string;
}

export class PasswordResetRequestDto {
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
}

export class PasswordResetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  @MaskLog({ type: 'full' })
  token!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  @MaskLog({ type: 'full' })
  newPassword!: string;
}

export class VerificationTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  @MaskLog({ type: 'full' })
  token!: string;
}

export class TotpConfirmationDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{6}$/, { message: 'TOTP 코드는 6자리 숫자여야 합니다' })
  @MaskLog({ type: 'full' })
  code!: string;
}

export class UpdateMfaPreferenceDto {
  @IsBoolean()
  enabled!: boolean;
}

export class UpdateProfileDto {
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
}

export class StartIdentityLinkDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  returnTo?: string;
}

export class IdentityLinkCallbackQuery {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  tenantCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tenant_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  @MaskLog({ type: 'full' })
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  error?: string;
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
  mfaEnabled!: boolean;

  @Expose()
  @Transform(({ value }) =>
    value instanceof Date ? value.toISOString() : value,
  )
  createdAt?: Date;

  @Expose()
  @Transform(({ value }) =>
    value instanceof Date ? value.toISOString() : value,
  )
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
  @Transform(({ value }) =>
    value instanceof Date ? value.toISOString() : value,
  )
  grantedAt!: Date;
}

export class RecoveryCodeStatusResponse {
  @Expose()
  remaining!: number;

  @Expose()
  total!: number;

  @Expose()
  low!: boolean;
}
