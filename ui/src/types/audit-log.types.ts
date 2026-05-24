import type { PaginationQuery } from './pagination.types';

export type AuditLogCategory =
  | 'AUTH'
  | 'USER'
  | 'ROLE'
  | 'GROUP'
  | 'PERMISSION'
  | 'SECURITY'
  | 'SYSTEM'
  | 'OTHER';

export type AuditLogSeverity = 'INFO' | 'WARN' | 'ERROR';

export type AuditLogAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'TOKEN_ISSUED'
  | 'TOKEN_REVOKED'
  | 'ACCESS_DENIED'
  | 'LINK_IDP'
  | 'UNLINK_IDP'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ASSIGN'
  | 'REVOKE'
  | 'CONFIG_CHANGE'
  | 'OTHER';

export interface AuditLogFilters extends PaginationQuery {
  from?: string;
  to?: string;
  userId?: string;
  clientId?: string;
  action?: AuditLogAction;
  category?: AuditLogCategory;
  severity?: AuditLogSeverity;
  correlationId?: string;
}

export interface AuditLogResponse {
  id?: string;
  category: AuditLogCategory;
  severity: AuditLogSeverity;
  action: AuditLogAction;
  userId: string | null;
  clientId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  success: boolean;
  reason: string | null;
  userAgent: string | null;
  correlationId: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: Date | string;
}
