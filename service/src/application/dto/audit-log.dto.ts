import type {
  EventAction,
  EventCategory,
  EventSeverity,
} from '@domain/models/event';
import type { PaginationQuery } from './pagination.dto';

export interface AuditLogQuery extends PaginationQuery {
  from?: string;
  to?: string;
  userId?: string;
  clientId?: string;
  action?: EventAction;
  category?: EventCategory;
  severity?: EventSeverity;
  correlationId?: string;
}

export interface AuditLogResponse {
  id: string | undefined;
  category: EventCategory;
  severity: EventSeverity;
  action: EventAction;
  userId: string | null;
  clientId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  success: boolean;
  reason: string | null;
  userAgent: string | null;
  correlationId: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: Date;
}
