import { InProcessEventBusAdapter } from '@infrastructure/adapters/in-proccess-event-bus.adapter';
import type { DomainEvent } from '@domain/events';
import type { DomainEventHandler } from '@application/command/ports/domain-event-handler';

function createEvent(
  eventType: string,
  version: number,
  aggregateId = 'agg-1',
): DomainEvent {
  return {
    eventType,
    aggregateId,
    occurredAt: new Date(),
    version,
    payload: {},
  };
}

function createHandler(eventType: string): jest.Mocked<DomainEventHandler> {
  return {
    eventType,
    handle: jest.fn().mockResolvedValue(undefined),
  };
}

describe('InProcessEventBusAdapter', () => {
  describe('publish', () => {
    it('해당 eventType의 핸들러를 호출한다', async () => {
      const handler = createHandler('user.created');
      const bus = new InProcessEventBusAdapter([handler]);
      const event = createEvent('user.created', 1);

      await bus.publish(event);

      expect(handler.handle).toHaveBeenCalledTimes(1);
      expect(handler.handle).toHaveBeenCalledWith(event);
    });

    it('매칭되는 핸들러가 없으면 아무 일도 하지 않는다', async () => {
      const handler = createHandler('user.created');
      const bus = new InProcessEventBusAdapter([handler]);
      const event = createEvent('user.deleted', 1);

      await expect(bus.publish(event)).resolves.toBeUndefined();
      expect(handler.handle).not.toHaveBeenCalled();
    });

    it('같은 eventType에 여러 핸들러가 등록되면 모두 호출한다', async () => {
      const handler1 = createHandler('user.created');
      const handler2 = createHandler('user.created');
      const bus = new InProcessEventBusAdapter([handler1, handler2]);
      const event = createEvent('user.created', 1);

      await bus.publish(event);

      expect(handler1.handle).toHaveBeenCalledTimes(1);
      expect(handler2.handle).toHaveBeenCalledTimes(1);
    });
  });

  describe('publishAll', () => {
    it('이벤트를 version 순서대로 발행한다', async () => {
      const handler = createHandler('user.created');
      const bus = new InProcessEventBusAdapter([handler]);
      const event1 = createEvent('user.created', 2);
      const event2 = createEvent('user.created', 1);

      await bus.publishAll([event1, event2]);

      expect(handler.handle).toHaveBeenCalledTimes(2);
      expect(handler.handle.mock.calls[0][0].version).toBe(1);
      expect(handler.handle.mock.calls[1][0].version).toBe(2);
    });

    it('빈 배열이면 핸들러를 호출하지 않는다', async () => {
      const handler = createHandler('user.created');
      const bus = new InProcessEventBusAdapter([handler]);

      await bus.publishAll([]);

      expect(handler.handle).not.toHaveBeenCalled();
    });
  });

  describe('핸들러 미등록', () => {
    it('핸들러 없이 생성해도 에러가 발생하지 않는다', async () => {
      const bus = new InProcessEventBusAdapter([]);
      const event = createEvent('user.created', 1);

      await expect(bus.publish(event)).resolves.toBeUndefined();
    });
  });
});
