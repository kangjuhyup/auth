import { TenantConfigMapper } from '@infrastructure/repositories/mapper/tenant-config.mapper';
import { TenantConfigModel } from '@domain/models/tenant-config';
import { TenantConfigOrmEntity } from '@infrastructure/mikro-orm/entities';

describe('TenantConfigMapper', () => {
  describe('toDomain', () => {
    it('ORM 엔티티를 도메인 모델로 변환한다', () => {
      const entity = Object.assign(new TenantConfigOrmEntity(), {
        tenant: { id: 'tenant-1' },
        signupPolicy: 'invite',
        requirePhoneVerify: true,
        brandName: 'Acme',
        accessTokenTtlSec: 300,
        refreshTokenTtlSec: 600,
        extra: { policies: { allowSignup: false } },
      });

      const domain = TenantConfigMapper.toDomain(entity);

      expect(domain.tenantId).toBe('tenant-1');
      expect(domain.signupPolicy).toBe('invite');
      expect(domain.requirePhoneVerify).toBe(true);
      expect(domain.brandName).toBe('Acme');
      expect(domain.accessTokenTtlSec).toBe(300);
      expect(domain.refreshTokenTtlSec).toBe(600);
      expect(domain.extra).toEqual({ policies: { allowSignup: false } });
    });
  });

  describe('toOrm', () => {
    it('도메인 모델 값으로 기존 엔티티를 갱신한다', () => {
      const existing = Object.assign(new TenantConfigOrmEntity(), {
        tenant: { id: 'tenant-1' },
        signupPolicy: 'open',
        requirePhoneVerify: false,
        brandName: 'Old Brand',
        accessTokenTtlSec: 3600,
        refreshTokenTtlSec: 7200,
        extra: { old: true },
      });
      const domain = new TenantConfigModel({
        tenantId: 'tenant-1',
        signupPolicy: 'invite',
        requirePhoneVerify: true,
        brandName: null,
        accessTokenTtlSec: 120,
        refreshTokenTtlSec: 240,
        extra: null,
      });

      const entity = TenantConfigMapper.toOrm(domain, existing);

      expect(entity).toBe(existing);
      expect(entity.signupPolicy).toBe('invite');
      expect(entity.requirePhoneVerify).toBe(true);
      expect(entity.brandName).toBeNull();
      expect(entity.accessTokenTtlSec).toBe(120);
      expect(entity.refreshTokenTtlSec).toBe(240);
      expect(entity.extra).toBeNull();
    });
  });
});
