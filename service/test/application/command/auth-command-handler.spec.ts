import { AuthCommandHandler } from '@application/command/commands/handlers/auth-command.handler';
import type { EventStorePort } from '@application/command/ports/event-store.port';
import type { EventBusPort } from '@application/command/ports/event-bus.port';
import type {
  PasswordHashPort,
  HashResult,
  HashPolicy,
} from '@application/command/ports/password-hash.port';

function createMockEventStore(): jest.Mocked<EventStorePort> {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    getEvents: jest.fn().mockResolvedValue([]),
  };
}

function createMockEventBus(): jest.Mocked<EventBusPort> {
  return {
    publish: jest.fn().mockResolvedValue(undefined),
    publishAll: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockPasswordHash(): jest.Mocked<PasswordHashPort> {
  const result: HashResult = {
    alg: 'argon2id',
    params: { timeCost: 3 },
    version: 1,
    hash: 'hashed-password',
  };
  return {
    defaultPolicy: jest.fn().mockReturnValue({
      alg: 'argon2id',
      params: {},
      version: 1,
    } as HashPolicy),
    hash: jest.fn().mockResolvedValue(result),
    verify: jest.fn().mockResolvedValue(true),
  };
}

describe('AuthCommandHandler', () => {
  let handler: AuthCommandHandler;
  let eventStore: jest.Mocked<EventStorePort>;
  let eventBus: jest.Mocked<EventBusPort>;
  let passwordHash: jest.Mocked<PasswordHashPort>;

  beforeEach(() => {
    eventStore = createMockEventStore();
    eventBus = createMockEventBus();
    passwordHash = createMockPasswordHash();
    handler = new AuthCommandHandler(eventStore, eventBus, passwordHash);
  });

  describe('signup', () => {
    const tenantId = 'tenant-1';
    const dto = { username: 'john', password: 'secure123' };

    it('userId를 반환한다', async () => {
      const result = await handler.signup(tenantId, dto);

      expect(result).toHaveProperty('userId');
      expect(typeof result.userId).toBe('string');
      expect(result.userId.length).toBeGreaterThan(0);
    });

    it('비밀번호를 해싱한다', async () => {
      await handler.signup(tenantId, dto);

      expect(passwordHash.hash).toHaveBeenCalledWith('secure123');
    });

    it('이벤트를 이벤트 스토어에 저장한다', async () => {
      await handler.signup(tenantId, dto);

      expect(eventStore.save).toHaveBeenCalledTimes(1);
      const [aggregateId, events, expectedVersion] =
        eventStore.save.mock.calls[0];
      expect(typeof aggregateId).toBe('string');
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('user.created');
      expect(expectedVersion).toBe(0);
    });

    it('이벤트를 이벤트 버스로 발행한다', async () => {
      await handler.signup(tenantId, dto);

      expect(eventBus.publishAll).toHaveBeenCalledTimes(1);
      const [events] = eventBus.publishAll.mock.calls[0];
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('user.created');
    });

    it('이벤트 스토어 저장 후 이벤트 버스를 호출한다', async () => {
      const callOrder: string[] = [];
      eventStore.save.mockImplementation(async () => {
        callOrder.push('eventStore.save');
      });
      eventBus.publishAll.mockImplementation(async () => {
        callOrder.push('eventBus.publishAll');
      });

      await handler.signup(tenantId, dto);

      expect(callOrder).toEqual(['eventStore.save', 'eventBus.publishAll']);
    });

    it('email과 phone 정보를 포함한 이벤트를 생성한다', async () => {
      await handler.signup(tenantId, {
        username: 'john',
        password: 'secure123',
        email: 'john@example.com',
        phone: '010-1234-5678',
      });

      const [, events] = eventStore.save.mock.calls[0];
      const payload = events[0].payload as any;
      expect(payload.email).toBe('john@example.com');
      expect(payload.phone).toBe('010-1234-5678');
    });
  });

  describe('withdraw', () => {
    it('비밀번호가 맞으면 이벤트 저장 후 발행한다', async () => {
      eventStore.getEvents.mockResolvedValue([
        {
          eventType: 'user.created',
          aggregateId: 'user-1',
          version: 1,
          occurredAt: new Date(),
          payload: {
            tenantId: 'tenant-1',
            credential: {
              secretHash: 'hash',
              hashAlg: 'argon2id',
            },
          },
        },
      ]);

      passwordHash.verify.mockResolvedValue(true);

      await handler.withdraw('tenant-1', 'user-1', { password: 'pw' } as any);

      expect(eventStore.getEvents).toHaveBeenCalledTimes(1);
      expect(passwordHash.verify).toHaveBeenCalledTimes(1);
      expect(eventStore.save).toHaveBeenCalledTimes(1);
      expect(eventBus.publishAll).toHaveBeenCalledTimes(1);
    });

    it('비밀번호가 틀리면 저장/발행하지 않는다', async () => {
      eventStore.getEvents.mockResolvedValue([
        {
          eventType: 'user.created',
          aggregateId: 'user-1',
          version: 1,
          occurredAt: new Date(),
          payload: {
            tenantId: 'tenant-1',
            credential: {
              secretHash: 'hash',
              hashAlg: 'argon2id',
            },
          },
        },
      ]);

      passwordHash.verify.mockResolvedValue(false);

      await expect(
        handler.withdraw('tenant-1', 'user-1', { password: 'pw' } as any),
      ).rejects.toThrow();

      expect(eventStore.save).not.toHaveBeenCalled();
      expect(eventBus.publishAll).not.toHaveBeenCalled();
    });
  });
});
