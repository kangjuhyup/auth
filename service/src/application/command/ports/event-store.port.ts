import { DomainEvent } from '@domain/events';

export const EVENT_STORE_PORT = Symbol('EVENT_STORE_PORT');

export interface EventStorePort {
  save(
    aggregateId: string,
    events: DomainEvent[],
    expectedVersion: number,
  ): Promise<void>;

  getEvents(aggregateId: string): Promise<DomainEvent[]>;
}
