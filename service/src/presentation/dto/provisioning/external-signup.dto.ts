import { MaskLog } from '@kangjuhyup/rvlog';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
export class ExternalSignupBody {
  @MaskLog({ type: 'full' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{32,256}$/)
  readonly ticket!: string;
  @IsString() @MinLength(1) @MaxLength(191) readonly clientId!: string;
  @IsString() @Matches(/^[A-Za-z0-9_-]{16,128}$/) readonly attemptId!: string;
  private constructor() {}
  static of(params: { ticket: string; clientId: string; attemptId: string }) {
    return Object.assign(new ExternalSignupBody(), params);
  }
}
export class ExternalSignupResumeBody {
  @MaskLog({ type: 'full' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{32,256}$/)
  readonly ticket!: string;
  @IsString() @Matches(/^[A-Za-z0-9_-]{16,128}$/) readonly attemptId!: string;
  private constructor() {}
  static of(params: { ticket: string; attemptId: string }) {
    return Object.assign(new ExternalSignupResumeBody(), params);
  }
}
