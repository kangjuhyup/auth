import { apiClient } from '@/lib/apiClient';
import { mockApi } from '@/lib/mockApi';
import type { PaginatedResult } from '@/types/pagination.types';
import type {
  CreateScopeDto,
  ScopeResponse,
  UpdateScopeDto,
} from '@/types/scope.types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

export const scopeApi = {
  list: (
    tenantCode: string,
    params: { page?: number; limit?: number },
  ): Promise<PaginatedResult<ScopeResponse>> => {
    if (USE_MOCK) return mockApi.scopes.list(params);
    return apiClient.get(`/t/${tenantCode}/admin/scopes`, { params });
  },

  get: (tenantCode: string, id: string): Promise<ScopeResponse> => {
    if (USE_MOCK) return mockApi.scopes.get(id);
    return apiClient.get(`/t/${tenantCode}/admin/scopes/${id}`);
  },

  create: (
    tenantCode: string,
    dto: CreateScopeDto,
  ): Promise<{ id: string }> => {
    if (USE_MOCK) return mockApi.scopes.create(dto);
    return apiClient.post(`/t/${tenantCode}/admin/scopes`, dto);
  },

  update: (
    tenantCode: string,
    id: string,
    dto: UpdateScopeDto,
  ): Promise<void> => {
    if (USE_MOCK) return mockApi.scopes.update(id, dto);
    return apiClient.put(`/t/${tenantCode}/admin/scopes/${id}`, dto);
  },

  delete: (tenantCode: string, id: string): Promise<void> => {
    if (USE_MOCK) return mockApi.scopes.delete(id);
    return apiClient.delete(`/t/${tenantCode}/admin/scopes/${id}`);
  },
};
