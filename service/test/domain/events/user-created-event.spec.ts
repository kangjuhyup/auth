import { UserCreatedEvent } from '@domain/events/user/user-created.event';
import { UserCredentialModel } from '@domain/models/user-credential';

describe('UserCreatedEvent', () => {
  const makeCredential = () =>
    UserCredentialModel.password({
      secretHash: 'hashed-pw',
      hashAlg: 'argon2id',
    });

  it('eventType이 "user.created"이다', () => {
    const event = new UserCreatedEvent('user-1', new Date(), 1, {
      tenantId: 'tenant-1',
      username: 'john',
      emailVerified: false,
      phoneVerified: false,
      status: 'ACTIVE',
      credential: makeCredential(),
    });

    expect(event.eventType).toBe('user.created');
  });

  it('aggregateId, version, occurredAt을 올바르게 저장한다', () => {
    const now = new Date('2025-06-01T00:00:00Z');
    const event = new UserCreatedEvent('user-1', now, 3, {
      tenantId: 'tenant-1',
      username: 'john',
      emailVerified: false,
      phoneVerified: false,
      status: 'ACTIVE',
      credential: makeCredential(),
    });

    expect(event.aggregateId).toBe('user-1');
    expect(event.version).toBe(3);
    expect(event.occurredAt).toBe(now);
  });

  it('payload에 사용자 정보를 포함한다', () => {
    const cred = makeCredential();
    const event = new UserCreatedEvent('user-1', new Date(), 1, {
      tenantId: 'tenant-1',
      username: 'john',
      email: 'john@example.com',
      emailVerified: false,
      phone: '010-1234-5678',
      phoneVerified: false,
      status: 'ACTIVE',
      credential: cred,
    });

    expect(event.payload.tenantId).toBe('tenant-1');
    expect(event.payload.username).toBe('john');
    expect(event.payload.email).toBe('john@example.com');
    expect(event.payload.phone).toBe('010-1234-5678');
    expect(event.payload.credential).toBe(cred);
  });
});
