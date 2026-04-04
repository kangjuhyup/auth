import { EventModel } from '../models/event';

export interface EventListQuery {
  tenantId: string;
  page: number;
  limit: number;
  category?: string;
  action?: string;
  userId?: string;
}

export abstract class EventRepository {
  abstract list(
    query: EventListQuery,
  ): Promise<{ items: EventModel[]; total: number }>;

  abstract save(event: EventModel): Promise<void>;
}
