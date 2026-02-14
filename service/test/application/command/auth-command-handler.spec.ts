import { AuthCommandHandler } from '@application/commands/handlers/auth-command.handler';
import type { EventStorePort } from '@application/ports/event-store.port';
import type { EventBusPort } from '@application/ports/event-bus.port';
import type {
  PasswordHashPort,
  HashResult,
  HashPolicy,
} from '@application/ports/password-hash.port';

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
    jest.clearAllMocks();

    eventStore = createMockEventStore();
    eventBus = createMockEventBus();
    passwordHash = createMockPasswordHash();

    handler = new AuthCommandHandler(eventStore, eventBus, passwordHash);
  });

  describe('signup', () => {
    const tenantId = 'tenant-1';
    const dto = { username: 'john', password: 'secure123' };

    it('정상 흐름: hash → save → publishAll 순서로 호출된다', async () => {
      await handler.signup(tenantId, dto as any);

      expect(passwordHash.hash).toHaveBeenCalledTimes(1);
      expect(eventStore.save).toHaveBeenCalledTimes(1);
      expect(eventBus.publishAll).toHaveBeenCalledTimes(1);

      // ✅ 호출 순서만 검증 (인자/값 검증 X)
      expect(passwordHash.hash.mock.invocationCallOrder[0]).toBeLessThan(
        eventStore.save.mock.invocationCallOrder[0],
      );
      expect(eventStore.save.mock.invocationCallOrder[0]).toBeLessThan(
        eventBus.publishAll.mock.invocationCallOrder[0],
      );
    });

    it('eventStore 저장 후 eventBus를 호출한다(순서)', async () => {
      await handler.signup(tenantId, dto as any);

      expect(eventStore.save.mock.invocationCallOrder[0]).toBeLessThan(
        eventBus.publishAll.mock.invocationCallOrder[0],
      );
    });
  });

  describe('withdraw', () => {
    beforeEach(() => {
      // ✅ withdraw가 rehydrate 가능한 최소 이벤트만 준비
      eventStore.getEvents.mockResolvedValue([
        {
          eventType: 'user.created',
          aggregateId: 'user-1',
          version: 1,
          occurredAt: new Date(),
          payload: {
            tenantId: 'tenant-1',
            username: 'john',
            emailVerified: false,
            phoneVerified: false,
            status: 'ACTIVE',
            credential: {
              type: 'password',
              secretHash: 'hash',
              hashAlg: 'argon2id',
              enabled: true,
              expiresAt: null,
            },
          },
        } as any,
      ]);
    });

    it('정상 흐름: getEvents → verify → save → publishAll 순서로 호출된다', async () => {
      passwordHash.verify.mockResolvedValue(true);

      await handler.withdraw('tenant-1', 'user-1', { password: 'pw' } as any);

      expect(eventStore.getEvents).toHaveBeenCalledTimes(1);
      expect(passwordHash.verify).toHaveBeenCalledTimes(1);
      expect(eventStore.save).toHaveBeenCalledTimes(1);
      expect(eventBus.publishAll).toHaveBeenCalledTimes(1);

      expect(eventStore.getEvents.mock.invocationCallOrder[0]).toBeLessThan(
        passwordHash.verify.mock.invocationCallOrder[0],
      );
      expect(passwordHash.verify.mock.invocationCallOrder[0]).toBeLessThan(
        eventStore.save.mock.invocationCallOrder[0],
      );
      expect(eventStore.save.mock.invocationCallOrder[0]).toBeLessThan(
        eventBus.publishAll.mock.invocationCallOrder[0],
      );
    });

    it('verify 실패 시 save/publishAll을 호출하지 않는다', async () => {
      passwordHash.verify.mockResolvedValue(false);

      await expect(
        handler.withdraw('tenant-1', 'user-1', { password: 'pw' } as any),
      ).rejects.toThrow();

      expect(eventStore.save).not.toHaveBeenCalled();
      expect(eventBus.publishAll).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    beforeEach(() => {
      // ✅ changePassword가 rehydrate 가능한 최소 이벤트
      eventStore.getEvents.mockResolvedValue([
        {
          eventType: 'user.created',
          aggregateId: 'user-1',
          version: 1,
          occurredAt: new Date(),
          payload: {
            tenantId: 'tenant-1',
            username: 'john',
            emailVerified: false,
            phoneVerified: false,
            status: 'ACTIVE',
            credential: {
              type: 'password',
              secretHash: 'old-hash',
              hashAlg: 'argon2id',
              enabled: true,
              expiresAt: null,
            },
          },
        } as any,
      ]);
    });

    it('정상 흐름: getEvents → verify → hash → save → publishAll 순서로 호출된다', async () => {
      await handler.changePassword('tenant-1', 'user-1', {
        currentPassword: 'old',
        newPassword: 'new',
      } as any);

      expect(eventStore.getEvents).toHaveBeenCalledTimes(1);
      expect(passwordHash.verify).toHaveBeenCalledTimes(1);

      expect(passwordHash.hash).toHaveBeenCalledTimes(1);

      expect(eventStore.save).toHaveBeenCalledTimes(1);
      expect(eventBus.publishAll).toHaveBeenCalledTimes(1);

      expect(eventStore.getEvents.mock.invocationCallOrder[0]).toBeLessThan(
        passwordHash.verify.mock.invocationCallOrder[0],
      );
      expect(passwordHash.verify.mock.invocationCallOrder[0]).toBeLessThan(
        passwordHash.hash.mock.invocationCallOrder[0],
      );
      expect(passwordHash.hash.mock.invocationCallOrder[0]).toBeLessThan(
        eventStore.save.mock.invocationCallOrder[0],
      );
      expect(eventStore.save.mock.invocationCallOrder[0]).toBeLessThan(
        eventBus.publishAll.mock.invocationCallOrder[0],
      );
    });

    it('verify 실패 시 save/publishAll을 호출하지 않는다', async () => {
      passwordHash.verify.mockResolvedValue(false);

      await expect(
        handler.changePassword('tenant-1', 'user-1', {
          currentPassword: 'wrong',
          newPassword: 'new',
        } as any),
      ).rejects.toThrow();

      expect(eventStore.save).not.toHaveBeenCalled();
      expect(eventBus.publishAll).not.toHaveBeenCalled();
    });

    it('유저 이벤트가 없으면(UserNotFound) verify/hash/save/publishAll을 호출하지 않는다', async () => {
      eventStore.getEvents.mockResolvedValue([]);

      await expect(
        handler.changePassword('tenant-1', 'user-1', {
          currentPassword: 'old',
          newPassword: 'new',
        } as any),
      ).rejects.toThrow();

      expect(passwordHash.verify).not.toHaveBeenCalled();
      expect(passwordHash.hash).not.toHaveBeenCalled();
      expect(eventStore.save).not.toHaveBeenCalled();
      expect(eventBus.publishAll).not.toHaveBeenCalled();
    });
  });
});
