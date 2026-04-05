import { RoleMapper } from '@infrastructure/repositories/mapper/role.mapper';
import { RoleModel } from '@domain/models/role';
import { RoleOrmEntity } from '@infrastructure/mikro-orm/entities';

describe('RoleMapper', () => {
  describe('toDomain', () => {
    it('ORM 엔티티를 도메인 모델로 변환한다', () => {
      const entity = Object.assign(new RoleOrmEntity(), {
        id: 'role-1',
        tenant: { id: 'tenant-1' },
        code: 'admin',
        name: 'Administrator',
        description: 'Admin role',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
      });

      const domain = RoleMapper.toDomain(entity);

      expect(domain.id).toBe('role-1');
      expect(domain.tenantId).toBe('tenant-1');
      expect(domain.code).toBe('admin');
      expect(domain.name).toBe('Administrator');
      expect(domain.description).toBe('Admin role');
      expect(domain.createdAt).toEqual(new Date('2025-01-01'));
      expect(domain.updatedAt).toEqual(new Date('2025-01-02'));
    });
  });

  describe('toOrm', () => {
    it('도메인 모델을 새 ORM 엔티티로 변환한다', () => {
      const domain = new RoleModel(
        {
          tenantId: 'tenant-1',
          code: 'editor',
          name: 'Editor',
          description: 'Editor role',
        },
        'role-2',
      );

      const entity = RoleMapper.toOrm(domain);

      expect(entity.id).toBe('role-2');
      expect(entity.code).toBe('editor');
      expect(entity.name).toBe('Editor');
      expect(entity.description).toBe('Editor role');
    });

    it('기존 엔티티가 있으면 code를 유지하고 설명과 이름만 갱신한다', () => {
      const existing = Object.assign(new RoleOrmEntity(), {
        id: 'role-3',
        code: 'original-code',
        name: 'Old Name',
        description: 'Old Description',
      });
      const domain = new RoleModel(
        {
          tenantId: 'tenant-1',
          code: 'new-code',
          name: 'New Name',
          description: null,
        },
        'role-3',
      );

      const entity = RoleMapper.toOrm(domain, existing);

      expect(entity).toBe(existing);
      expect(entity.code).toBe('original-code');
      expect(entity.name).toBe('New Name');
      expect(entity.description).toBeNull();
    });
  });
});
