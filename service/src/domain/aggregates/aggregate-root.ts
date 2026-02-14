import { DomainEvent } from '../events/domain-event';

export abstract class AggregateRoot {
  private uncommittedEvents: DomainEvent[] = [];
  protected version = 0;

  get id(): string {
    return this.aggregateId;
  }

  get currentVersion(): number {
    return this.version;
  }

  constructor(protected readonly aggregateId: string) {}

  getUncommittedEvents(): DomainEvent[] {
    return [...this.uncommittedEvents];
  }

  clearUncommittedEvents(): void {
    this.uncommittedEvents = [];
  }

  protected apply(event: DomainEvent): void {
    this.when(event);
    this.version = event.version;
    this.uncommittedEvents.push(event);
  }

  rehydrate(events: DomainEvent[]): void {
    for (const event of events) {
      this.when(event);
      this.version = event.version;
    }
  }

  protected abstract when(event: DomainEvent): void;
}
