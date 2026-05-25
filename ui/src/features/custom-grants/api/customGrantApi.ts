import { apiClient } from '@/lib/apiClient';
import { mockApi } from '@/lib/mockApi';
import type { PaginatedResult } from '@/types/pagination.types';
import type {
  CreateCustomGrantDto,
  CustomGrantResponse,
  UpdateCustomGrantDto,
} from '@/types/custom-grant.types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

export const customGrantApi = {
  list: (
    tenantCode: string,
    params: { page?: number; limit?: number },
  ): Promise<PaginatedResult<CustomGrantResponse>> => {
    if (USE_MOCK) return mockApi.customGrants.list(params);
    return apiClient.get(`/t/${tenantCode}/admin/custom-grants`, { params });
  },

  get: (tenantCode: string, id: string): Promise<CustomGrantResponse> => {
    if (USE_MOCK) return mockApi.customGrants.get(id);
    return apiClient.get(`/t/${tenantCode}/admin/custom-grants/${id}`);
  },

  create: (
    tenantCode: string,
    dto: CreateCustomGrantDto,
  ): Promise<{ id: string }> => {
    if (USE_MOCK) return mockApi.customGrants.create(dto);
    return apiClient.post(`/t/${tenantCode}/admin/custom-grants`, dto);
  },

  update: (
    tenantCode: string,
    id: string,
    dto: UpdateCustomGrantDto,
  ): Promise<void> => {
    if (USE_MOCK) return mockApi.customGrants.update(id, dto);
    return apiClient.put(`/t/${tenantCode}/admin/custom-grants/${id}`, dto);
  },

  delete: (tenantCode: string, id: string): Promise<void> => {
    if (USE_MOCK) return mockApi.customGrants.delete(id);
    return apiClient.delete(`/t/${tenantCode}/admin/custom-grants/${id}`);
  },
};
