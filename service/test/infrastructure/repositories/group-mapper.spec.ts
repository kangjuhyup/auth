import { GroupMapper } from '@infrastructure/repositories/mapper/group.mapper';
import { GroupModel } from '@domain/models/group';
import { GroupOrmEntity } from '@infrastructure/mikro-orm/entities';

describe('GroupMapper', () => {
  describe('toDomain', () => {
    it('ORM 엔티티를 도메인 모델로 변환한다', () => {
      const entity = Object.assign(new GroupOrmEntity(), {
        id: 'group-1',
        tenant: { id: 'tenant-1' },
        code: 'dev',
        name: 'Dev Team',
        parent: { id: 'group-parent' },
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
      });

      const domain = GroupMapper.toDomain(entity);

      expect(domain.id).toBe('group-1');
      expect(domain.tenantId).toBe('tenant-1');
      expect(domain.code).toBe('dev');
      expect(domain.name).toBe('Dev Team');
      expect(domain.parentId).toBe('group-parent');
      expect(domain.createdAt).toEqual(new Date('2025-01-01'));
      expect(domain.updatedAt).toEqual(new Date('2025-01-02'));
    });

    it('parent가 없으면 parentId를 null로 매핑한다', () => {
      const entity = Object.assign(new GroupOrmEntity(), {
        id: 'group-2',
        tenant: { id: 'tenant-1' },
        code: 'ops',
        name: 'Ops Team',
        parent: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
      });

      const domain = GroupMapper.toDomain(entity);

      expect(domain.parentId).toBeNull();
    });
  });

  describe('toOrm', () => {
    it('도메인 모델을 새 ORM 엔티티로 변환한다', () => {
      const domain = new GroupModel(
        { tenantId: 'tenant-1', code: 'dev', name: 'Dev Team', parentId: null },
        'group-1',
      );

      const entity = GroupMapper.toOrm(domain);

      expect(entity.id).toBe('group-1');
      expect(entity.code).toBe('dev');
      expect(entity.name).toBe('Dev Team');
    });

    it('기존 엔티티가 있으면 code는 유지하고 name만 갱신한다', () => {
      const existing = Object.assign(new GroupOrmEntity(), {
        id: 'group-1',
        code: 'original-code',
        name: 'Old Name',
      });
      const domain = new GroupModel(
        { tenantId: 'tenant-1', code: 'new-code', name: 'New Name', parentId: null },
        'group-1',
      );

      const entity = GroupMapper.toOrm(domain, existing);

      expect(entity).toBe(existing);
      expect(entity.code).toBe('original-code');
      expect(entity.name).toBe('New Name');
    });
  });
});
