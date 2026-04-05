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
  list: (
    tenantCode: string,
    params: { page?: number; limit?: number },
  ): Promise<PaginatedResult<GroupResponse>> => {
    if (USE_MOCK) return mockApi.groups.list(params);
    return apiClient.get(`/t/${tenantCode}/admin/groups`, { params });
  },

  get: (tenantCode: string, id: string): Promise<GroupResponse> => {
    if (USE_MOCK) return mockApi.groups.get(id);
    return apiClient.get(`/t/${tenantCode}/admin/groups/${id}`);
  },

  create: (tenantCode: string, dto: CreateGroupDto): Promise<{ id: string }> => {
    if (USE_MOCK) return mockApi.groups.create(dto);
    return apiClient.post(`/t/${tenantCode}/admin/groups`, dto);
  },

  update: (tenantCode: string, id: string, dto: UpdateGroupDto): Promise<void> => {
    if (USE_MOCK) return mockApi.groups.update(id, dto);
    return apiClient.put(`/t/${tenantCode}/admin/groups/${id}`, dto);
  },

  delete: (tenantCode: string, id: string): Promise<void> => {
    if (USE_MOCK) return mockApi.groups.delete(id);
    return apiClient.delete(`/t/${tenantCode}/admin/groups/${id}`);
  },

  getRoles: (tenantCode: string, groupId: string): Promise<RoleResponse[]> => {
    if (USE_MOCK) return mockApi.groups.getRoles(groupId);
    return apiClient.get(`/t/${tenantCode}/admin/groups/${groupId}/roles`);
  },

  addRole: (tenantCode: string, groupId: string, roleId: string): Promise<void> => {
    if (USE_MOCK) return mockApi.groups.addRole(groupId, roleId);
    return apiClient.post(`/t/${tenantCode}/admin/groups/${groupId}/roles/${roleId}`);
  },

  removeRole: (tenantCode: string, groupId: string, roleId: string): Promise<void> => {
    if (USE_MOCK) return mockApi.groups.removeRole(groupId, roleId);
    return apiClient.delete(`/t/${tenantCode}/admin/groups/${groupId}/roles/${roleId}`);
  },
};
