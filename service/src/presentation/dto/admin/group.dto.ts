import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Expose, Transform } from 'class-transformer';

const BIGINT_REGEX = /^\d+$/;
const BIGINT_MESSAGE = '양의 정수여야 합니다';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9_.-]+$/, { message: 'code는 영문자, 숫자, _, ., - 만 허용됩니다' })
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name!: string;

  @IsOptional()
  @Matches(BIGINT_REGEX, { message: BIGINT_MESSAGE })
  parentId?: string;
}

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @ValidateIf((o) => o.parentId !== null)
  @Matches(BIGINT_REGEX, { message: BIGINT_MESSAGE })
  parentId?: string | null;
}

export class GroupResponse {
  @Expose()
  id!: string;

  @Expose()
  code!: string;

  @Expose()
  name!: string;

  @Expose()
  parentId?: string | null;

  @Expose()
  @Transform(({ value }) => (value instanceof Date ? value.toISOString() : value))
  createdAt!: Date;

  @Expose()
  @Transform(({ value }) => (value instanceof Date ? value.toISOString() : value))
  updatedAt!: Date;
}
