import { EventModel } from '@domain/models/event';
import type { EventCategory, EventSeverity, EventAction } from '@domain/models/event';
import { EventOrmEntity } from '../../mikro-orm/entities/event';

export class EventMapper {
  static toDomain(entity: EventOrmEntity): EventModel {
    return new EventModel(
      {
        tenantId: entity.tenant.id,
        userId: entity.user?.id ?? null,
        clientId: entity.client?.id ?? null,
        category: entity.category as EventCategory,
        severity: entity.severity as EventSeverity,
        action: entity.action as EventAction,
        resourceType: entity.resourceType ?? null,
        resourceId: entity.resourceId ?? null,
        success: entity.success,
        reason: entity.reason ?? null,
        ip: entity.ip ?? null,
        userAgent: entity.userAgent ?? null,
        metadata: entity.metadata ?? null,
        occurredAt: entity.occurredAt,
      },
      entity.id,
    );
  }
}
