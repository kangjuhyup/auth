import { Inject, Injectable } from '@nestjs/common';
import type { DomainEvent } from '@domain/events';
import type { EventBusPort } from '@application/command/ports/event-bus.port';
import type { DomainEventHandler } from '@application/command/ports/domain-event-handler';
import { DOMAIN_EVENT_HANDLERS } from '@application/command/ports';

@Injectable()
export class InProcessEventBusAdapter implements EventBusPort {
  private readonly handlersByType = new Map<string, DomainEventHandler[]>();

  constructor(
    @Inject(DOMAIN_EVENT_HANDLERS)
    handlers: DomainEventHandler[],
  ) {
    for (const h of handlers) {
      const list = this.handlersByType.get(h.eventType) ?? [];
      list.push(h);
      this.handlersByType.set(h.eventType, list);
    }
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    const sorted = [...events].sort((a, b) => a.version - b.version);

    for (const e of sorted) {
      await this.publish(e);
    }
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlersByType.get(event.eventType) ?? [];
    if (handlers.length === 0) return;

    for (const h of handlers) {
      await h.handle(event);
    }
  }
}
