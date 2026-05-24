import { Injectable } from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/core';
import {
  EventRepository,
  EventListQuery,
} from '@domain/repositories/event.repository';
import { EventModel } from '@domain/models/event';
import { EventOrmEntity } from '../mikro-orm/entities/event';
import { TenantOrmEntity } from '../mikro-orm/entities/tenant';
import { UserOrmEntity } from '../mikro-orm/entities/user';
import { ClientOrmEntity } from '../mikro-orm/entities/client';
import { EventMapper } from './mapper/event.mapper';

@Injectable()
export class EventRepositoryImpl implements EventRepository {
  constructor(private readonly em: EntityManager) {}

  async list(
    query: EventListQuery,
  ): Promise<{ items: EventModel[]; total: number }> {
    const offset = (query.page - 1) * query.limit;
    const where: FilterQuery<EventOrmEntity> = {
      tenant: { id: query.tenantId },
    };

    if (query.from || query.to) {
      where.occurredAt = {
        ...(query.from ? { $gte: query.from } : {}),
        ...(query.to ? { $lte: query.to } : {}),
      };
    }
    if (query.category) {
      where.category = query.category;
    }
    if (query.severity) {
      where.severity = query.severity;
    }
    if (query.action) {
      where.action = query.action;
    }
    if (query.userId) {
      where.user = { id: query.userId };
    }
    if (query.clientId) {
      where.client = { id: query.clientId };
    }
    if (query.correlationId) {
      where.correlationId = query.correlationId;
    }

    const [entities, total] = await this.em.findAndCount(
      EventOrmEntity,
      where,
      {
        populate: ['tenant', 'user', 'client'],
        limit: query.limit,
        offset,
        orderBy: { occurredAt: 'DESC' },
      },
    );
    return { items: entities.map(EventMapper.toDomain), total };
  }

  async save(event: EventModel): Promise<void> {
    const entity = new EventOrmEntity();
    entity.tenant = this.em.getReference(TenantOrmEntity, event.tenantId);

    if (event.userId) {
      entity.user = this.em.getReference(UserOrmEntity, event.userId);
    }
    if (event.clientId) {
      entity.client = this.em.getReference(ClientOrmEntity, event.clientId);
    }

    entity.category = event.category;
    entity.severity = event.severity;
    entity.action = event.action;
    entity.resourceType = event.resourceType ?? null;
    entity.resourceId = event.resourceId ?? null;
    entity.success = event.success;
    entity.reason = event.reason ?? null;
    entity.ip = event.ip ?? null;
    entity.userAgent = event.userAgent ?? null;
    entity.correlationId = event.correlationId ?? null;
    entity.metadata = event.metadata ?? null;
    entity.occurredAt = event.occurredAt;

    await this.em.persist(entity).flush();
  }
}
