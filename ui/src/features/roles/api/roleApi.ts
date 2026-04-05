import { apiClient } from '@/lib/apiClient';
import { mockApi } from '@/lib/mockApi';
import type { PaginatedResult } from '@/types/pagination.types';
import type {
  RoleResponse,
  CreateRoleDto,
  UpdateRoleDto,
} from '@/types/role.types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

export const roleApi = {
  list: (
    tenantCode: string,
    params: { page?: number; limit?: number },
  ): Promise<PaginatedResult<RoleResponse>> => {
    if (USE_MOCK) return mockApi.roles.list(params);
    return apiClient.get(`/t/${tenantCode}/admin/roles`, { params });
  },

  get: (tenantCode: string, id: string): Promise<RoleResponse> => {
    if (USE_MOCK) return mockApi.roles.get(id);
    return apiClient.get(`/t/${tenantCode}/admin/roles/${id}`);
  },

  create: (tenantCode: string, dto: CreateRoleDto): Promise<{ id: string }> => {
    if (USE_MOCK) return mockApi.roles.create(dto);
    return apiClient.post(`/t/${tenantCode}/admin/roles`, dto);
  },

  update: (tenantCode: string, id: string, dto: UpdateRoleDto): Promise<void> => {
    if (USE_MOCK) return mockApi.roles.update(id, dto);
    return apiClient.put(`/t/${tenantCode}/admin/roles/${id}`, dto);
  },

  delete: (tenantCode: string, id: string): Promise<void> => {
    if (USE_MOCK) return mockApi.roles.delete(id);
    return apiClient.delete(`/t/${tenantCode}/admin/roles/${id}`);
  },
};
