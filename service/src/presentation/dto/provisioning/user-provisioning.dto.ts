import { MaskLog } from '@kangjuhyup/rvlog';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ProvisionUserBody {
  @ApiProperty({ example: 'alice' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9_.-]+$/)
  username!: string;

  @ApiProperty({ format: 'password', minLength: 8, maxLength: 128 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  @MaskLog({ type: 'full' })
  password!: string;
}

export class ProvisionUserResponse {
  @ApiProperty({ description: 'OIDC subject for the created Auth user' })
  subject!: string;
}
