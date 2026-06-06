import { EventModel } from '../models/event';
import type {
  EventAction,
  EventCategory,
  EventSeverity,
} from '../models/event';

export interface EventListQuery {
  tenantId: string;
  page: number;
  limit: number;
  from?: Date;
  to?: Date;
  category?: EventCategory;
  action?: EventAction;
  severity?: EventSeverity;
  userId?: string;
  clientId?: string;
  correlationId?: string;
}

export abstract class EventRepository {
  abstract list(
    query: EventListQuery,
  ): Promise<{ items: EventModel[]; total: number }>;

  abstract save(event: EventModel): Promise<void>;
}
