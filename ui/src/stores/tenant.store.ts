import { create } from 'zustand';
import type { TenantResponse } from '@/types/tenant.types';

interface TenantState {
  selectedTenant: TenantResponse | null;
  setTenant: (tenant: TenantResponse) => void;
  clearTenant: () => void;
}

export const useTenantStore = create<TenantState>((set) => ({
  selectedTenant: null,
  setTenant: (tenant) => set({ selectedTenant: tenant }),
  clearTenant: () => set({ selectedTenant: null }),
}));
