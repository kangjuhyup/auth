import { DomainEvent } from '@domain/events';
import { UserCreatedEvent } from '@domain/events/user/user-created.event';
import { UserModel } from '@domain/models/user';
import { UserCredentialModel } from '@domain/models/user-credential';

describe('UserModel', () => {
  const makeCredential = () =>
    UserCredentialModel.password({
      secretHash: 'hashed-pw',
      hashAlg: 'argon2id',
      hashParams: { timeCost: 3 },
      hashVersion: 1,
    });

  function makeCreatedEvent(): DomainEvent {
    return {
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
          secretHash: 'hash',
          hashAlg: 'argon2id',
        },
      },
    } as any;
  }

  describe('signup', () => {
    it('주어진 속성으로 사용자를 생성한다', () => {
      const cred = makeCredential();
      const user = UserModel.signup({
        id: 'user-1',
        tenantId: 'tenant-1',
        username: 'john',
        email: 'john@example.com',
        phone: '010-1234-5678',
        passwordCredential: cred,
      });

      expect(user.id).toBe('user-1');
      expect(user.tenantId).toBe('tenant-1');
      expect(user.username).toBe('john');
      expect(user.email).toBe('john@example.com');
      expect(user.phone).toBe('010-1234-5678');
    });

    it('초기 상태는 ACTIVE이다', () => {
      const user = UserModel.signup({
        id: 'user-1',
        tenantId: 'tenant-1',
        username: 'john',
        passwordCredential: makeCredential(),
      });

      expect(user.status).toBe('ACTIVE');
    });

    it('이메일/전화 인증 상태는 false로 초기화된다', () => {
      const user = UserModel.signup({
        id: 'user-1',
        tenantId: 'tenant-1',
        username: 'john',
        passwordCredential: makeCredential(),
      });

      expect(user.emailVerified).toBe(false);
      expect(user.phoneVerified).toBe(false);
    });

    it('username 앞뒤 공백을 제거한다', () => {
      const user = UserModel.signup({
        id: 'user-1',
        tenantId: 'tenant-1',
        username: '  john  ',
        passwordCredential: makeCredential(),
      });

      expect(user.username).toBe('john');
    });

    it('UserCreatedEvent를 발행한다', () => {
      const cred = makeCredential();
      const user = UserModel.signup({
        id: 'user-1',
        tenantId: 'tenant-1',
        username: 'john',
        email: 'john@example.com',
        passwordCredential: cred,
      });

      const events = user.pullEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('user.created');
      expect(events[0].aggregateId).toBe('user-1');
      expect(events[0].version).toBe(1);
    });

    it('pullEvents 호출 후 이벤트가 비워진다', () => {
      const user = UserModel.signup({
        id: 'user-1',
        tenantId: 'tenant-1',
        username: 'john',
        passwordCredential: makeCredential(),
      });

      user.pullEvents();
      const secondPull = user.pullEvents();
      expect(secondPull).toHaveLength(0);
    });

    it('email과 phone이 없어도 생성된다', () => {
      const user = UserModel.signup({
        id: 'user-1',
        tenantId: 'tenant-1',
        username: 'john',
        passwordCredential: makeCredential(),
      });

      expect(user.email).toBeUndefined();
      expect(user.phone).toBeUndefined();
    });

    it('occurredAt을 지정하면 이벤트에 반영된다', () => {
      const fixedDate = new Date('2025-01-01T00:00:00Z');
      const user = UserModel.signup({
        id: 'user-1',
        tenantId: 'tenant-1',
        username: 'john',
        passwordCredential: makeCredential(),
        occurredAt: fixedDate,
      });

      const events = user.pullEvents();
      expect(events[0].occurredAt).toBe(fixedDate);
    });
  });

  describe('UserModel.withdraw', () => {
    it('withdraw를 호출하면 status가 WITHDRAWN이 된다', () => {
      const user = UserModel.rehydrate([makeCreatedEvent()]);

      user.withdraw();

      expect(user.status).toBe('WITHDRAWN');
    });

    it('withdraw를 호출하면 user.withdrawn 이벤트가 생성된다', () => {
      const user = UserModel.rehydrate([makeCreatedEvent()]);

      user.withdraw();

      const events = user.pullEvents();

      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe('user.withdrawn');
    });

    it('이미 WITHDRAWN 상태면 예외가 발생한다', () => {
      const withdrawnEvent: DomainEvent = {
        eventType: 'user.withdrawn',
        aggregateId: 'user-1',
        version: 2,
        occurredAt: new Date(),
        payload: { tenantId: 'tenant-1', withdrawnAt: new Date() },
      } as any;

      const user = UserModel.rehydrate([makeCreatedEvent(), withdrawnEvent]);

      expect(() => user.withdraw()).toThrow();
    });
  });

  describe('changePassword', () => {
    it('rehydrate 후 getPasswordCredential()로 현재 credential을 얻는다', () => {
      const user = UserModel.rehydrate([makeCreatedEvent()]);
      const cred = user.getPasswordCredential();

      expect(cred).toBeTruthy();
    });

    it('changePassword를 호출하면 이벤트가 1개 발생하고 eventType이 맞다', () => {
      const user = UserModel.rehydrate([makeCreatedEvent()]);

      user.changePassword({
        tenantId: 'tenant-1',
        newCredential: {
          type: 'password',
          secretHash: 'new-hash',
          hashAlg: 'argon2id',
          hashParams: null,
          hashVersion: null,
          enabled: true,
          expiresAt: null,
        } as any,
      });

      const events = user.pullEvents();

      expect(events).toHaveLength(1);
      expect((events[0] as any).eventType).toBe('user.password_changed');
    });

    it('changePassword를 호출하면 모델의 현재 passwordCredential이 갱신된다', () => {
      const user = UserModel.rehydrate([makeCreatedEvent()]);

      user.changePassword({
        tenantId: 'tenant-1',
        newCredential: {
          type: 'password',
          secretHash: 'new-hash',
          hashAlg: 'argon2id',
        } as any,
      });

      const cred = user.getPasswordCredential();
      expect((cred as any).secretHash).toBe('new-hash');
    });
  });
});
