import type {
  EventAction,
  EventCategory,
  EventSeverity,
} from '@domain/models/event';

export class AuditLogQuery {
  private constructor(
    public readonly page?: number,
    public readonly limit?: number,
    public readonly from?: string,
    public readonly to?: string,
    public readonly userId?: string,
    public readonly clientId?: string,
    public readonly action?: EventAction,
    public readonly category?: EventCategory,
    public readonly severity?: EventSeverity,
    public readonly correlationId?: string,
  ) {}

  static of(params: {
    page?: number;
    limit?: number;
    from?: string;
    to?: string;
    userId?: string;
    clientId?: string;
    action?: EventAction;
    category?: EventCategory;
    severity?: EventSeverity;
    correlationId?: string;
  }): AuditLogQuery {
    return new AuditLogQuery(
      params.page,
      params.limit,
      params.from,
      params.to,
      params.userId,
      params.clientId,
      params.action,
      params.category,
      params.severity,
      params.correlationId,
    );
  }
}

export class AuditLogResponse {
  private constructor(
    public readonly id: string | undefined,
    public readonly category: EventCategory,
    public readonly severity: EventSeverity,
    public readonly action: EventAction,
    public readonly userId: string | null,
    public readonly clientId: string | null,
    public readonly resourceType: string | null,
    public readonly resourceId: string | null,
    public readonly success: boolean,
    public readonly reason: string | null,
    public readonly userAgent: string | null,
    public readonly correlationId: string | null,
    public readonly metadata: Record<string, unknown> | null,
    public readonly occurredAt: Date,
  ) {}

  static of(params: {
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
  }): AuditLogResponse {
    return new AuditLogResponse(
      params.id,
      params.category,
      params.severity,
      params.action,
      params.userId,
      params.clientId,
      params.resourceType,
      params.resourceId,
      params.success,
      params.reason,
      params.userAgent,
      params.correlationId,
      params.metadata,
      params.occurredAt,
    );
  }
}
