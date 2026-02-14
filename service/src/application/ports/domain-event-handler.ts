import type { DomainEvent } from '@domain/events';

export interface DomainEventHandler<T extends DomainEvent = DomainEvent> {
  /** 처리할 이벤트 타입 (예: 'UserCreated') */
  readonly eventType: string;

  handle(event: T): Promise<void>;
}
