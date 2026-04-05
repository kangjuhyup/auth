import { PermissionMapper } from '@infrastructure/repositories/mapper/permission.mapper';
import { PermissionModel } from '@domain/models/permission';
import { PermissionOrmEntity } from '@infrastructure/mikro-orm/entities';

describe('PermissionMapper', () => {
  describe('toDomain', () => {
    it('ORM 엔티티를 도메인 모델로 변환한다', () => {
      const entity = Object.assign(new PermissionOrmEntity(), {
        id: 'perm-1',
        tenant: { id: 'tenant-1' },
        code: 'users:read',
        resource: 'users',
        action: 'read',
        description: 'Read users',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
      });

      const domain = PermissionMapper.toDomain(entity);

      expect(domain.id).toBe('perm-1');
      expect(domain.tenantId).toBe('tenant-1');
      expect(domain.code).toBe('users:read');
      expect(domain.resource).toBe('users');
      expect(domain.action).toBe('read');
      expect(domain.description).toBe('Read users');
      expect(domain.createdAt).toEqual(new Date('2025-01-01'));
      expect(domain.updatedAt).toEqual(new Date('2025-01-02'));
    });
  });

  describe('toOrm', () => {
    it('도메인 모델을 새 ORM 엔티티로 변환한다', () => {
      const domain = new PermissionModel(
        {
          tenantId: 'tenant-1',
          code: 'users:write',
          resource: 'users',
          action: 'write',
          description: 'Write users',
        },
        'perm-2',
      );

      const entity = PermissionMapper.toOrm(domain);

      expect(entity.id).toBe('perm-2');
      expect(entity.code).toBe('users:write');
      expect(entity.resource).toBe('users');
      expect(entity.action).toBe('write');
      expect(entity.description).toBe('Write users');
    });

    it('기존 엔티티가 있으면 code는 유지하고 나머지 필드는 갱신한다', () => {
      const existing = Object.assign(new PermissionOrmEntity(), {
        id: 'perm-3',
        code: 'original-code',
        resource: 'old-resource',
        action: 'old-action',
        description: 'old-description',
      });
      const domain = new PermissionModel(
        {
          tenantId: 'tenant-1',
          code: 'new-code',
          resource: null,
          action: null,
          description: null,
        },
        'perm-3',
      );

      const entity = PermissionMapper.toOrm(domain, existing);

      expect(entity).toBe(existing);
      expect(entity.code).toBe('original-code');
      expect(entity.resource).toBeNull();
      expect(entity.action).toBeNull();
      expect(entity.description).toBeNull();
    });
  });
});
