import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class PasswordPolicyDto {
  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(128)
  minLength?: number;

  @IsOptional()
  @IsBoolean()
  requireUppercase?: boolean;

  @IsOptional()
  @IsBoolean()
  requireLowercase?: boolean;

  @IsOptional()
  @IsBoolean()
  requireNumber?: boolean;

  @IsOptional()
  @IsBoolean()
  requireSymbol?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  preventReuseCount?: number;

  @IsOptional()
  @ValidateIf((o) => o.expiresInDays !== null)
  @IsInt()
  @Min(1)
  @Max(3650)
  expiresInDays?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  lockoutFailureThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(86400)
  lockoutDurationSec?: number;
}

class MfaPolicyDto {
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsBoolean()
  adminRequired?: boolean;
}

class AllowedIdpPolicyDto {
  @IsOptional()
  @ValidateIf((o) => o.providerKeys !== null)
  @IsArray()
  @ArrayMaxSize(50)
  @MaxLength(128, { each: true })
  @Matches(/^[a-zA-Z0-9_.:-]+$/, {
    each: true,
    message: 'providerKeys는 영문자, 숫자, _, ., :, - 만 허용됩니다',
  })
  providerKeys?: string[] | null;
}

class SessionPolicyDto {
  @IsOptional()
  @ValidateIf((o) => o.maxAgeSec !== null)
  @IsInt()
  @Min(60)
  @Max(31536000)
  maxAgeSec?: number | null;

  @IsOptional()
  @IsBoolean()
  requireAuthTime?: boolean;

  @IsOptional()
  @ValidateIf((o) => o.reauthenticationIntervalSec !== null)
  @IsInt()
  @Min(60)
  @Max(31536000)
  reauthenticationIntervalSec?: number | null;

  @IsOptional()
  @IsIn(['multi', 'single'])
  loginSessionMode?: 'multi' | 'single';

  @IsOptional()
  @ValidateIf((o) => o.maxConcurrentSessions !== null)
  @IsInt()
  @Min(1)
  @Max(100)
  maxConcurrentSessions?: number | null;

  @IsOptional()
  @IsIn(['deny_new_login', 'revoke_previous_sessions', 'revoke_oldest_session'])
  sessionConflictAction?:
    | 'deny_new_login'
    | 'revoke_previous_sessions'
    | 'revoke_oldest_session';
}

class RefreshTokenPolicyDto {
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(31536000)
  ttlSec?: number;

  @IsOptional()
  @IsBoolean()
  rotationEnabled?: boolean;

  @IsOptional()
  @IsIn(['revoke_grant'])
  reuseAction?: 'revoke_grant';
}

class SignupPolicyDto {
  @IsOptional()
  @IsIn(['invite', 'open'])
  mode?: 'invite' | 'open';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @MaxLength(253, { each: true })
  @Matches(/^[a-zA-Z0-9.-]+$/, {
    each: true,
    message: 'allowedEmailDomains는 도메인 형식만 허용됩니다',
  })
  allowedEmailDomains?: string[];
}

export class UpdateTenantPoliciesDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PasswordPolicyDto)
  password?: PasswordPolicyDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MfaPolicyDto)
  mfa?: MfaPolicyDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AllowedIdpPolicyDto)
  allowedIdp?: AllowedIdpPolicyDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SessionPolicyDto)
  session?: SessionPolicyDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RefreshTokenPolicyDto)
  refreshToken?: RefreshTokenPolicyDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SignupPolicyDto)
  signup?: SignupPolicyDto;
}
