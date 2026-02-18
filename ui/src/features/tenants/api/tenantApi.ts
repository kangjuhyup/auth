import { apiClient } from '@/lib/apiClient';
import { mockApi } from '@/lib/mockApi';
import type { PaginatedResult } from '@/types/pagination.types';
import type {
  TenantResponse,
  CreateTenantDto,
  UpdateTenantDto,
} from '@/types/tenant.types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

export const tenantApi = {
  list: (params: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<TenantResponse>> => {
    if (USE_MOCK) return mockApi.tenants.list(params);
    return apiClient.get('/admin/tenants', { params });
  },

  get: (id: string): Promise<TenantResponse> => {
    if (USE_MOCK) return mockApi.tenants.get(id);
    return apiClient.get(`/admin/tenants/${id}`);
  },

  create: (dto: CreateTenantDto): Promise<{ id: string }> => {
    if (USE_MOCK) return mockApi.tenants.create(dto);
    return apiClient.post('/admin/tenants', dto);
  },

  update: (id: string, dto: UpdateTenantDto): Promise<void> => {
    if (USE_MOCK) return mockApi.tenants.update(id, dto);
    return apiClient.put(`/admin/tenants/${id}`, dto);
  },

  delete: (id: string): Promise<void> => {
    if (USE_MOCK) return mockApi.tenants.delete(id);
    return apiClient.delete(`/admin/tenants/${id}`);
  },
};
