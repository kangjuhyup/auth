import { Injectable } from '@nestjs/common';
import { ulid } from 'ulid';
import type { AuditContext } from '@application/dto';
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
  auditContext?: AuditContext | null;
}

@Injectable()
export class AuditRecorder {
  constructor(private readonly eventRepo: EventRepository) {}

  async recordAdminAction(params: AdminAuditParams): Promise<void> {
    const metadata = this.buildMetadata(params.metadata, params.auditContext);

    await this.eventRepo.save(
      new EventModel({
        tenantId: params.tenantId,
        userId: params.auditContext?.actorUserId ?? null,
        category: params.category ?? 'SYSTEM',
        severity: params.severity ?? 'INFO',
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId ?? null,
        success: params.success ?? true,
        reason: params.reason ?? null,
        ip: this.toIpBuffer(params.auditContext?.ipAddress),
        userAgent: params.auditContext?.userAgent ?? null,
        correlationId:
          params.correlationId ?? params.auditContext?.correlationId ?? ulid(),
        metadata,
        occurredAt: new Date(),
      }),
    );
  }

  private buildMetadata(
    metadata?: Record<string, unknown> | null,
    auditContext?: AuditContext | null,
  ): Record<string, unknown> | null {
    const actorUsername = auditContext?.actorUsername;
    if (!actorUsername) {
      return metadata ?? null;
    }

    return {
      ...(metadata ?? {}),
      actor: {
        username: actorUsername,
      },
    };
  }

  private toIpBuffer(ipAddress?: string | null): Buffer | null {
    return ipAddress ? Buffer.from(ipAddress, 'utf8') : null;
  }
}
