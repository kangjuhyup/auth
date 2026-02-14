import { UserPasswordChangedEvent } from '@domain/events/user/user-password-change.event';

describe('UserPasswordChangedEvent', () => {
  it('eventType이 "user.password_changed"이다', () => {
    const ev = new UserPasswordChangedEvent('user-1', new Date(), 2, {
      tenantId: 'tenant-1',
      changedAt: new Date(),
      credential: {} as any,
    });

    expect(ev.eventType).toBe('user.password_changed');
  });

  it('aggregateId, version, occurredAt을 올바르게 저장한다', () => {
    const now = new Date('2025-06-01T00:00:00Z');
    const ev = new UserPasswordChangedEvent('user-1', now, 5, {
      tenantId: 'tenant-1',
      changedAt: now,
      credential: {} as any,
    });

    expect(ev.aggregateId).toBe('user-1');
    expect(ev.version).toBe(5);
    expect(ev.occurredAt).toBe(now);
  });

  it('payload에 tenantId/changedAt/credential을 포함한다', () => {
    const cred = {
      type: 'password',
      secretHash: 'h',
      hashAlg: 'argon2id',
    } as any;
    const changedAt = new Date();

    const ev = new UserPasswordChangedEvent('user-1', new Date(), 1, {
      tenantId: 'tenant-1',
      changedAt,
      credential: cred,
    });

    expect(ev.payload.tenantId).toBe('tenant-1');
    expect(ev.payload.changedAt).toBe(changedAt);
    expect(ev.payload.credential).toBe(cred);
  });
});
