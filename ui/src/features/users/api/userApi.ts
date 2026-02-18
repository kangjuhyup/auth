import { apiClient } from '@/lib/apiClient';
import { mockApi } from '@/lib/mockApi';
import type { PaginatedResult } from '@/types/pagination.types';
import type {
  UserResponse,
  CreateUserDto,
  UpdateUserDto,
} from '@/types/user.types';
import type { RoleResponse } from '@/types/role.types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

export const userApi = {
  list: (params: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<UserResponse>> => {
    if (USE_MOCK) return mockApi.users.list(params);
    return apiClient.get('/admin/users', { params });
  },

  get: (id: string): Promise<UserResponse> => {
    if (USE_MOCK) return mockApi.users.get(id);
    return apiClient.get(`/admin/users/${id}`);
  },

  create: (dto: CreateUserDto): Promise<{ id: string }> => {
    if (USE_MOCK) return mockApi.users.create(dto);
    return apiClient.post('/admin/users', dto);
  },

  update: (id: string, dto: UpdateUserDto): Promise<void> => {
    if (USE_MOCK) return mockApi.users.update(id, dto);
    return apiClient.put(`/admin/users/${id}`, dto);
  },

  delete: (id: string): Promise<void> => {
    if (USE_MOCK) return mockApi.users.delete(id);
    return apiClient.delete(`/admin/users/${id}`);
  },

  // Role assignment endpoints
  getRoles: (userId: string): Promise<RoleResponse[]> => {
    if (USE_MOCK) return mockApi.users.getRoles(userId);
    return apiClient.get(`/admin/users/${userId}/roles`);
  },

  addRole: (userId: string, roleId: string): Promise<void> => {
    if (USE_MOCK) return mockApi.users.addRole(userId, roleId);
    return apiClient.post(`/admin/users/${userId}/roles/${roleId}`);
  },

  removeRole: (userId: string, roleId: string): Promise<void> => {
    if (USE_MOCK) return mockApi.users.removeRole(userId, roleId);
    return apiClient.delete(`/admin/users/${userId}/roles/${roleId}`);
  },
};
