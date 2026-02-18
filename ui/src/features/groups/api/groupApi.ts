import { apiClient } from '@/lib/apiClient';
import { mockApi } from '@/lib/mockApi';
import type { PaginatedResult } from '@/types/pagination.types';
import type {
  GroupResponse,
  CreateGroupDto,
  UpdateGroupDto,
} from '@/types/group.types';
import type { RoleResponse } from '@/types/role.types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

export const groupApi = {
  list: (params: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<GroupResponse>> => {
    if (USE_MOCK) return mockApi.groups.list(params);
    return apiClient.get('/admin/groups', { params });
  },

  get: (id: string): Promise<GroupResponse> => {
    if (USE_MOCK) return mockApi.groups.get(id);
    return apiClient.get(`/admin/groups/${id}`);
  },

  create: (dto: CreateGroupDto): Promise<{ id: string }> => {
    if (USE_MOCK) return mockApi.groups.create(dto);
    return apiClient.post('/admin/groups', dto);
  },

  update: (id: string, dto: UpdateGroupDto): Promise<void> => {
    if (USE_MOCK) return mockApi.groups.update(id, dto);
    return apiClient.put(`/admin/groups/${id}`, dto);
  },

  delete: (id: string): Promise<void> => {
    if (USE_MOCK) return mockApi.groups.delete(id);
    return apiClient.delete(`/admin/groups/${id}`);
  },

  // Role assignment endpoints
  getRoles: (groupId: string): Promise<RoleResponse[]> => {
    if (USE_MOCK) return mockApi.groups.getRoles(groupId);
    return apiClient.get(`/admin/groups/${groupId}/roles`);
  },

  addRole: (groupId: string, roleId: string): Promise<void> => {
    if (USE_MOCK) return mockApi.groups.addRole(groupId, roleId);
    return apiClient.post(`/admin/groups/${groupId}/roles/${roleId}`);
  },

  removeRole: (groupId: string, roleId: string): Promise<void> => {
    if (USE_MOCK) return mockApi.groups.removeRole(groupId, roleId);
    return apiClient.delete(`/admin/groups/${groupId}/roles/${roleId}`);
  },
};
