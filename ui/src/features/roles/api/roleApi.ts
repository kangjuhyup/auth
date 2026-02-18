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
  list: (params: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<RoleResponse>> => {
    if (USE_MOCK) return mockApi.roles.list(params);
    return apiClient.get('/admin/roles', { params });
  },

  get: (id: string): Promise<RoleResponse> => {
    if (USE_MOCK) return mockApi.roles.get(id);
    return apiClient.get(`/admin/roles/${id}`);
  },

  create: (dto: CreateRoleDto): Promise<{ id: string }> => {
    if (USE_MOCK) return mockApi.roles.create(dto);
    return apiClient.post('/admin/roles', dto);
  },

  update: (id: string, dto: UpdateRoleDto): Promise<void> => {
    if (USE_MOCK) return mockApi.roles.update(id, dto);
    return apiClient.put(`/admin/roles/${id}`, dto);
  },

  delete: (id: string): Promise<void> => {
    if (USE_MOCK) return mockApi.roles.delete(id);
    return apiClient.delete(`/admin/roles/${id}`);
  },
};
