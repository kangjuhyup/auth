import { EventMapper } from '@infrastructure/repositories/mapper/event.mapper';
import { EventOrmEntity } from '@infrastructure/mikro-orm/entities';

describe('EventMapper', () => {
  it('ORM 엔티티를 도메인 모델로 변환한다', () => {
    const entity = Object.assign(new EventOrmEntity(), {
      id: 'event-1',
      tenant: { id: 'tenant-1' },
      user: { id: 'user-1' },
      client: { id: 'client-1' },
      category: 'AUTH',
      severity: 'INFO',
      action: 'LOGIN',
      resourceType: 'session',
      resourceId: 'session-1',
      success: true,
      reason: null,
      ip: Buffer.from('127.0.0.1'),
      userAgent: 'jest',
      metadata: { source: 'test' },
      occurredAt: new Date('2025-01-01T00:00:00.000Z'),
    });

    const domain = EventMapper.toDomain(entity);

    expect(domain.id).toBe('event-1');
    expect(domain.tenantId).toBe('tenant-1');
    expect(domain.userId).toBe('user-1');
    expect(domain.clientId).toBe('client-1');
    expect(domain.category).toBe('AUTH');
    expect(domain.severity).toBe('INFO');
    expect(domain.action).toBe('LOGIN');
    expect(domain.resourceType).toBe('session');
    expect(domain.resourceId).toBe('session-1');
    expect(domain.success).toBe(true);
    expect(domain.ip).toEqual(Buffer.from('127.0.0.1'));
    expect(domain.metadata).toEqual({ source: 'test' });
  });

  it('nullable 관계와 선택 필드를 null로 유지한다', () => {
    const entity = Object.assign(new EventOrmEntity(), {
      id: 'event-2',
      tenant: { id: 'tenant-1' },
      user: null,
      client: null,
      category: 'OTHER',
      severity: 'WARN',
      action: 'OTHER',
      resourceType: null,
      resourceId: null,
      success: false,
      reason: 'denied',
      ip: null,
      userAgent: null,
      metadata: null,
      occurredAt: new Date('2025-01-01T00:00:00.000Z'),
    });

    const domain = EventMapper.toDomain(entity);

    expect(domain.userId).toBeNull();
    expect(domain.clientId).toBeNull();
    expect(domain.resourceType).toBeNull();
    expect(domain.resourceId).toBeNull();
    expect(domain.reason).toBe('denied');
    expect(domain.ip).toBeNull();
    expect(domain.userAgent).toBeNull();
    expect(domain.metadata).toBeNull();
  });
});
