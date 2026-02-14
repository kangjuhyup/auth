import { UserWithdrawnEvent } from '@domain/events/user/user-withdrawn.event';

describe('UserWithdrawnEvent', () => {
  it('eventType이 "user.withdrawn"이다', () => {
    const event = new UserWithdrawnEvent('user-1', new Date(), 2, {
      tenantId: 'tenant-1',
      withdrawnAt: new Date(),
    });

    expect(event.eventType).toBe('user.withdrawn');
  });

  it('aggregateId, version, occurredAt을 올바르게 저장한다', () => {
    const now = new Date('2026-01-01T00:00:00Z');

    const event = new UserWithdrawnEvent('user-1', now, 5, {
      tenantId: 'tenant-1',
      withdrawnAt: now,
    });

    expect(event.aggregateId).toBe('user-1');
    expect(event.version).toBe(5);
    expect(event.occurredAt).toBe(now);
  });

  it('payload에 tenantId와 withdrawnAt을 포함한다', () => {
    const now = new Date();

    const event = new UserWithdrawnEvent('user-1', now, 2, {
      tenantId: 'tenant-1',
      withdrawnAt: now,
    });

    expect(event.payload.tenantId).toBe('tenant-1');
    expect(event.payload.withdrawnAt).toBe(now);
  });
});
