import { TenantMapper } from '@infrastructure/repositories/mapper/tenant.mapper';
import { TenantModel } from '@domain/models/tenant';
import { TenantOrmEntity } from '@infrastructure/mikro-orm/entities';

describe('TenantMapper', () => {
  describe('toDomain', () => {
    it('ORM 엔티티를 도메인 모델로 변환한다', () => {
      const entity = Object.assign(new TenantOrmEntity(), {
        id: '1',
        code: 'acme',
        name: 'Acme Corp',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
      });

      const domain = TenantMapper.toDomain(entity);

      expect(domain.id).toBe('1');
      expect(domain.code).toBe('acme');
      expect(domain.name).toBe('Acme Corp');
      expect(domain.createdAt).toEqual(new Date('2025-01-01'));
      expect(domain.updatedAt).toEqual(new Date('2025-01-02'));
    });
  });

  describe('toOrm', () => {
    it('도메인 모델을 새 ORM 엔티티로 변환한다', () => {
      const domain = new TenantModel({ code: 'acme', name: 'Acme Corp' }, '1');

      const entity = TenantMapper.toOrm(domain);

      expect(entity.id).toBe('1');
      expect(entity.code).toBe('acme');
      expect(entity.name).toBe('Acme Corp');
    });

    it('기존 엔티티가 있으면 name만 업데이트한다', () => {
      const existing = Object.assign(new TenantOrmEntity(), {
        id: '1',
        code: 'acme',
        name: 'Old Name',
      });
      const domain = new TenantModel({ code: 'acme', name: 'New Name' }, '1');

      const entity = TenantMapper.toOrm(domain, existing);

      expect(entity).toBe(existing);
      expect(entity.name).toBe('New Name');
      expect(entity.code).toBe('acme');
    });

    it('기존 엔티티가 있으면 code를 변경하지 않는다', () => {
      const existing = Object.assign(new TenantOrmEntity(), {
        id: '1',
        code: 'original-code',
        name: 'Name',
      });
      const domain = new TenantModel({ code: 'new-code', name: 'Name' }, '1');

      const entity = TenantMapper.toOrm(domain, existing);

      expect(entity.code).toBe('original-code');
    });
  });
});
