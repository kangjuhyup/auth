import { apiClient } from '@/lib/apiClient';
import { mockApi } from '@/lib/mockApi';
import type { PaginatedResult } from '@/types/pagination.types';
import type {
  ClientResponse,
  CreateClientDto,
  UpdateClientDto,
} from '@/types/client.types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

export const clientApi = {
  list: (
    tenantCode: string,
    params: { page?: number; limit?: number },
  ): Promise<PaginatedResult<ClientResponse>> => {
    if (USE_MOCK) return mockApi.clients.list(params);
    return apiClient.get(`/t/${tenantCode}/admin/clients`, { params });
  },

  get: (tenantCode: string, id: string): Promise<ClientResponse> => {
    if (USE_MOCK) return mockApi.clients.get(id);
    return apiClient.get(`/t/${tenantCode}/admin/clients/${id}`);
  },

  create: (tenantCode: string, dto: CreateClientDto): Promise<{ id: string }> => {
    if (USE_MOCK) return mockApi.clients.create(dto);
    return apiClient.post(`/t/${tenantCode}/admin/clients`, dto);
  },

  update: (tenantCode: string, id: string, dto: UpdateClientDto): Promise<void> => {
    if (USE_MOCK) return mockApi.clients.update(id, dto);
    return apiClient.put(`/t/${tenantCode}/admin/clients/${id}`, dto);
  },

  delete: (tenantCode: string, id: string): Promise<void> => {
    if (USE_MOCK) return mockApi.clients.delete(id);
    return apiClient.delete(`/t/${tenantCode}/admin/clients/${id}`);
  },
};
