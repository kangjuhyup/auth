export interface DomainEvent<T = unknown> {
  readonly eventType: string;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly version: number;
  readonly payload: T;
}
