import { Expose, Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQuery } from '../common/pagination.dto';

const EVENT_CATEGORIES = [
  'AUTH',
  'USER',
  'ROLE',
  'GROUP',
  'PERMISSION',
  'SECURITY',
  'SYSTEM',
  'OTHER',
] as const;

const EVENT_SEVERITIES = ['INFO', 'WARN', 'ERROR'] as const;

const EVENT_ACTIONS = [
  'LOGIN',
  'LOGOUT',
  'TOKEN_ISSUED',
  'TOKEN_REVOKED',
  'ACCESS_DENIED',
  'LINK_IDP',
  'UNLINK_IDP',
  'CREATE',
  'UPDATE',
  'DELETE',
  'ASSIGN',
  'REVOKE',
  'CONFIG_CHANGE',
  'OTHER',
] as const;

export class AuditLogQuery extends PaginationQuery {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  clientId?: string;

  @IsOptional()
  @IsIn(EVENT_ACTIONS)
  action?: (typeof EVENT_ACTIONS)[number];

  @IsOptional()
  @IsIn(EVENT_CATEGORIES)
  category?: (typeof EVENT_CATEGORIES)[number];

  @IsOptional()
  @IsIn(EVENT_SEVERITIES)
  severity?: (typeof EVENT_SEVERITIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(128)
  correlationId?: string;
}

export class AuditLogResponse {
  @Expose()
  id?: string;

  @Expose()
  category!: string;

  @Expose()
  severity!: string;

  @Expose()
  action!: string;

  @Expose()
  userId!: string | null;

  @Expose()
  clientId!: string | null;

  @Expose()
  resourceType!: string | null;

  @Expose()
  resourceId!: string | null;

  @Expose()
  success!: boolean;

  @Expose()
  reason!: string | null;

  @Expose()
  userAgent!: string | null;

  @Expose()
  correlationId!: string | null;

  @Expose()
  metadata!: Record<string, unknown> | null;

  @Expose()
  @Transform(({ value }) =>
    value instanceof Date ? value.toISOString() : value,
  )
  occurredAt!: Date;
}
