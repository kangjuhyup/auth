import { describe, it, expect } from 'vitest';
import { queryKeys } from '@/lib/queryKeys';

describe('queryKeys', () => {
  describe('health', () => {
    it('["health"] 를 반환한다', () => {
      expect(queryKeys.health).toEqual(['health']);
    });
  });

  describe('admin.tenants', () => {
    it('all 키가 ["admin", "tenants"] 이다', () => {
      expect(queryKeys.admin.tenants.all).toEqual(['admin', 'tenants']);
    });

    it('list 키가 all 를 prefix 로 포함한다', () => {
      const listKey = queryKeys.admin.tenants.list({ page: 1, limit: 10 });
      expect(listKey.slice(0, 2)).toEqual(['admin', 'tenants']);
    });

    it('필터가 다르면 list 키가 다르다', () => {
      const key1 = queryKeys.admin.tenants.list({ page: 1 });
      const key2 = queryKeys.admin.tenants.list({ page: 2 });
      expect(key1).not.toEqual(key2);
    });

    it('detail 키가 all 를 prefix 로 포함하고 id 를 담는다', () => {
      const detailKey = queryKeys.admin.tenants.detail('tenant-1');
      expect(detailKey.slice(0, 2)).toEqual(['admin', 'tenants']);
      expect(detailKey).toContain('tenant-1');
    });
  });

  describe('admin.clients (tenant-scoped)', () => {
    it('list 키에 tenantId 가 포함된다', () => {
      const listKey = queryKeys.admin.clients.list('acme', { page: 1 });
      expect(listKey).toContain('acme');
    });

    it('서로 다른 tenant 의 list 키가 다르다', () => {
      const key1 = queryKeys.admin.clients.list('acme', { page: 1 });
      const key2 = queryKeys.admin.clients.list('globex', { page: 1 });
      expect(key1).not.toEqual(key2);
    });

    it('detail 키에 tenantId 와 resourceId 가 모두 포함된다', () => {
      const detailKey = queryKeys.admin.clients.detail('acme', 'client-1');
      expect(detailKey).toContain('acme');
      expect(detailKey).toContain('client-1');
    });
  });

  describe('admin.users (roles 포함)', () => {
    it('roles 키가 all 를 prefix 로 포함하고 userId 를 담는다', () => {
      const rolesKey = queryKeys.admin.users.roles('acme', 'user-99');
      expect(rolesKey.slice(0, 2)).toEqual(['admin', 'users']);
      expect(rolesKey).toContain('acme');
      expect(rolesKey).toContain('user-99');
    });

    it('list 키와 roles 키는 동일한 tenantId 에서도 서로 다르다', () => {
      const listKey = queryKeys.admin.users.list('acme', { page: 1 });
      const rolesKey = queryKeys.admin.users.roles('acme', 'user-1');
      expect(listKey).not.toEqual(rolesKey);
    });
  });

  describe('admin.groups (roles 포함)', () => {
    it('roles 키가 groupId 를 담는다', () => {
      const rolesKey = queryKeys.admin.groups.roles('acme', 'group-5');
      expect(rolesKey).toContain('acme');
      expect(rolesKey).toContain('group-5');
    });
  });

  describe('리소스 간 키 충돌 없음', () => {
    it('users.all 과 clients.all 은 다르다', () => {
      expect(queryKeys.admin.users.all).not.toEqual(
        queryKeys.admin.clients.all,
      );
    });

    it('roles.all 과 groups.all 은 다르다', () => {
      expect(queryKeys.admin.roles.all).not.toEqual(queryKeys.admin.groups.all);
    });

    it('identityProviders.all 은 다른 리소스와 다르다', () => {
      const ipAll = queryKeys.admin.identityProviders.all;
      expect(ipAll).not.toEqual(queryKeys.admin.users.all);
      expect(ipAll).not.toEqual(queryKeys.admin.clients.all);
    });
  });
});
