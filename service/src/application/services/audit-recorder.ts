import { Injectable } from '@nestjs/common';
import { EventModel } from '@domain/models/event';
import type {
  EventAction,
  EventCategory,
  EventSeverity,
} from '@domain/models/event';
import { EventRepository } from '@domain/repositories';

export interface AdminAuditParams {
  tenantId: string;
  action: EventAction;
  resourceType: string;
  resourceId?: string | null;
  category?: EventCategory;
  severity?: EventSeverity;
  success?: boolean;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  correlationId?: string | null;
}

@Injectable()
export class AuditRecorder {
  constructor(private readonly eventRepo: EventRepository) {}

  async recordAdminAction(params: AdminAuditParams): Promise<void> {
    await this.eventRepo.save(
      new EventModel({
        tenantId: params.tenantId,
        category: params.category ?? 'SYSTEM',
        severity: params.severity ?? 'INFO',
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId ?? null,
        success: params.success ?? true,
        reason: params.reason ?? null,
        correlationId: params.correlationId ?? null,
        metadata: params.metadata ?? null,
        occurredAt: new Date(),
      }),
    );
  }
}
