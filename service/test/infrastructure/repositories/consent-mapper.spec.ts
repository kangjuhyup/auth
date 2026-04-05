import { ConsentMapper } from '@infrastructure/repositories/mapper/consent.mapper';
import { ConsentModel } from '@domain/models/consent';
import { ConsentOrmEntity } from '@infrastructure/mikro-orm/entities';

function makeClientRef(initialized = true) {
  return initialized
    ? {
        id: 'client-ref-1',
        isInitialized: () => true,
        unwrap: () => ({
          clientId: 'web-client',
          name: 'Web Client',
        }),
      }
    : {
        id: 'client-ref-1',
        isInitialized: () => false,
        unwrap: () => {
          throw new Error('should not unwrap');
        },
      };
}

describe('ConsentMapper', () => {
  describe('toDomain', () => {
    it('초기화된 client ref를 포함해 ORM 엔티티를 도메인 모델로 변환한다', () => {
      const entity = Object.assign(new ConsentOrmEntity(), {
        id: 'consent-1',
        tenant: { id: 'tenant-1' },
        user: { id: 'user-1' },
        client: makeClientRef(true),
        grantedScopes: 'openid profile',
        grantedAt: new Date('2025-01-01T00:00:00.000Z'),
        revokedAt: null,
      });

      const domain = ConsentMapper.toDomain(entity);

      expect(domain.id).toBe('consent-1');
      expect(domain.tenantId).toBe('tenant-1');
      expect(domain.userId).toBe('user-1');
      expect(domain.clientRefId).toBe('client-ref-1');
      expect(domain.clientId).toBe('web-client');
      expect(domain.clientName).toBe('Web Client');
      expect(domain.grantedScopes).toBe('openid profile');
      expect(domain.revokedAt).toBeNull();
    });

    it('client ref가 초기화되지 않았으면 clientId/clientName을 비운다', () => {
      const entity = Object.assign(new ConsentOrmEntity(), {
        id: 'consent-2',
        tenant: { id: 'tenant-1' },
        user: { id: 'user-1' },
        client: makeClientRef(false),
        grantedScopes: 'openid',
        grantedAt: new Date('2025-01-01T00:00:00.000Z'),
        revokedAt: new Date('2025-01-02T00:00:00.000Z'),
      });

      const domain = ConsentMapper.toDomain(entity);

      expect(domain.clientId).toBeUndefined();
      expect(domain.clientName).toBeUndefined();
      expect(domain.revokedAt).toEqual(new Date('2025-01-02T00:00:00.000Z'));
    });
  });

  describe('toOrm', () => {
    it('도메인 모델을 새 ORM 엔티티로 변환한다', () => {
      const domain = new ConsentModel(
        {
          tenantId: 'tenant-1',
          userId: 'user-1',
          clientRefId: 'client-ref-1',
          grantedScopes: 'openid email',
          grantedAt: new Date('2025-01-03T00:00:00.000Z'),
          revokedAt: null,
        },
        'consent-3',
      );

      const entity = ConsentMapper.toOrm(domain);

      expect(entity.id).toBe('consent-3');
      expect(entity.grantedScopes).toBe('openid email');
      expect(entity.grantedAt).toEqual(new Date('2025-01-03T00:00:00.000Z'));
      expect(entity.revokedAt).toBeNull();
    });

    it('기존 엔티티가 있으면 revoke 정보까지 업데이트한다', () => {
      const existing = Object.assign(new ConsentOrmEntity(), {
        id: 'consent-4',
        grantedScopes: 'openid',
        grantedAt: new Date('2025-01-01T00:00:00.000Z'),
        revokedAt: null,
      });
      const revokedAt = new Date('2025-01-04T00:00:00.000Z');
      const domain = new ConsentModel(
        {
          tenantId: 'tenant-1',
          userId: 'user-1',
          clientRefId: 'client-ref-1',
          grantedScopes: 'openid profile',
          grantedAt: new Date('2025-01-03T00:00:00.000Z'),
          revokedAt,
        },
        'consent-4',
      );

      const entity = ConsentMapper.toOrm(domain, existing);

      expect(entity).toBe(existing);
      expect(entity.grantedScopes).toBe('openid profile');
      expect(entity.revokedAt).toEqual(revokedAt);
    });
  });
});
