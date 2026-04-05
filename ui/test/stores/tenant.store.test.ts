import { describe, it, expect, beforeEach } from 'vitest';
import { useTenantStore } from '@/stores/tenant.store';
import type { TenantResponse } from '@/types/tenant.types';

const mockTenant: TenantResponse = {
  id: 'tenant-1',
  code: 'acme',
  name: 'ACME Corp',
  brandName: 'ACME',
  signupPolicy: 'open',
  requirePhoneVerify: false,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('useTenantStore', () => {
  beforeEach(() => {
    useTenantStore.setState({ selectedTenant: null });
  });

  describe('초기 상태', () => {
    it('selectedTenant 가 null 이다', () => {
      expect(useTenantStore.getState().selectedTenant).toBeNull();
    });
  });

  describe('setTenant()', () => {
    it('selectedTenant 를 설정한다', () => {
      useTenantStore.getState().setTenant(mockTenant);
      expect(useTenantStore.getState().selectedTenant).toEqual(mockTenant);
    });

    it('다른 tenant 로 교체할 수 있다', () => {
      const anotherTenant: TenantResponse = {
        ...mockTenant,
        id: 'tenant-2',
        code: 'globex',
      };
      useTenantStore.getState().setTenant(mockTenant);
      useTenantStore.getState().setTenant(anotherTenant);
      expect(useTenantStore.getState().selectedTenant?.code).toBe('globex');
    });
  });

  describe('clearTenant()', () => {
    it('설정된 tenant 를 null 로 초기화한다', () => {
      useTenantStore.getState().setTenant(mockTenant);
      useTenantStore.getState().clearTenant();
      expect(useTenantStore.getState().selectedTenant).toBeNull();
    });
  });
});
