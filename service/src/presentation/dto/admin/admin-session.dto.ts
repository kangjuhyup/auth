import { MaskLog } from '@kangjuhyup/rvlog';
import { IsNotEmpty, IsString } from 'class-validator';

export class AdminLoginDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MaskLog({ type: 'full' })
  password!: string;
}
