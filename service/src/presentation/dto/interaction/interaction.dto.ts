import { MaskLog } from '@kangjuhyup/rvlog';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class InteractionLoginDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  @MaskLog({ type: 'full' })
  password?: string;
}

export class InteractionMfaDto {
  @IsIn(['totp', 'webauthn', 'recovery_code'])
  method!: 'totp' | 'webauthn' | 'recovery_code';

  @IsOptional()
  @IsString()
  @MaskLog({ type: 'full' })
  code?: string;

  @IsOptional()
  @IsObject()
  @MaskLog({ type: 'full' })
  webauthnResponse?: Record<string, unknown>;
}

export class InteractionTotpConfirmationDto {
  @IsString()
  @IsNotEmpty()
  @MaskLog({ type: 'full' })
  code!: string;
}

export class InteractionPasswordChangeDto {
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

export class SamlCallbackDto {
  @IsOptional()
  @IsString()
  @MaskLog({ type: 'full' })
  SAMLResponse?: string;

  @IsOptional()
  @IsString()
  @MaskLog({ type: 'full' })
  RelayState?: string;
}
