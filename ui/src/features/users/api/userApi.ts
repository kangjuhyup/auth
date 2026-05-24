import { apiClient } from '@/lib/apiClient';
import { mockApi } from '@/lib/mockApi';
import type { PaginatedResult } from '@/types/pagination.types';
import type {
  UserResponse,
  UserConsentResponse,
  CreateUserDto,
  UpdateUserDto,
} from '@/types/user.types';
import type { RoleResponse } from '@/types/role.types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

export const userApi = {
  list: (
    tenantCode: string,
    params: { page?: number; limit?: number },
  ): Promise<PaginatedResult<UserResponse>> => {
    if (USE_MOCK) return mockApi.users.list(params);
    return apiClient.get(`/t/${tenantCode}/admin/users`, { params });
  },

  get: (tenantCode: string, id: string): Promise<UserResponse> => {
    if (USE_MOCK) return mockApi.users.get(id);
    return apiClient.get(`/t/${tenantCode}/admin/users/${id}`);
  },

  create: (tenantCode: string, dto: CreateUserDto): Promise<{ id: string }> => {
    if (USE_MOCK) return mockApi.users.create(dto);
    return apiClient.post(`/t/${tenantCode}/admin/users`, dto);
  },

  update: (
    tenantCode: string,
    id: string,
    dto: UpdateUserDto,
  ): Promise<void> => {
    if (USE_MOCK) return mockApi.users.update(id, dto);
    return apiClient.put(`/t/${tenantCode}/admin/users/${id}`, dto);
  },

  delete: (tenantCode: string, id: string): Promise<void> => {
    if (USE_MOCK) return mockApi.users.delete(id);
    return apiClient.delete(`/t/${tenantCode}/admin/users/${id}`);
  },

  getRoles: (tenantCode: string, userId: string): Promise<RoleResponse[]> => {
    if (USE_MOCK) return mockApi.users.getRoles(userId);
    return apiClient.get(`/t/${tenantCode}/admin/users/${userId}/roles`);
  },

  getConsents: (
    tenantCode: string,
    userId: string,
    params: { page?: number; limit?: number },
  ): Promise<PaginatedResult<UserConsentResponse>> => {
    if (USE_MOCK) return mockApi.users.getConsents(userId, params);
    return apiClient.get(`/t/${tenantCode}/admin/users/${userId}/consents`, {
      params,
    });
  },

  getConsentHistory: (
    tenantCode: string,
    userId: string,
    params: { page?: number; limit?: number },
  ): Promise<PaginatedResult<UserConsentResponse>> => {
    if (USE_MOCK) return mockApi.users.getConsentHistory(userId, params);
    return apiClient.get(
      `/t/${tenantCode}/admin/users/${userId}/consents/history`,
      { params },
    );
  },

  addRole: (
    tenantCode: string,
    userId: string,
    roleId: string,
  ): Promise<void> => {
    if (USE_MOCK) return mockApi.users.addRole(userId, roleId);
    return apiClient.post(
      `/t/${tenantCode}/admin/users/${userId}/roles/${roleId}`,
    );
  },

  removeRole: (
    tenantCode: string,
    userId: string,
    roleId: string,
  ): Promise<void> => {
    if (USE_MOCK) return mockApi.users.removeRole(userId, roleId);
    return apiClient.delete(
      `/t/${tenantCode}/admin/users/${userId}/roles/${roleId}`,
    );
  },
};
