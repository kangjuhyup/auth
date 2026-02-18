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
  list: (params: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<ClientResponse>> => {
    if (USE_MOCK) return mockApi.clients.list(params);
    return apiClient.get('/admin/clients', { params });
  },

  get: (id: string): Promise<ClientResponse> => {
    if (USE_MOCK) return mockApi.clients.get(id);
    return apiClient.get(`/admin/clients/${id}`);
  },

  create: (dto: CreateClientDto): Promise<{ id: string }> => {
    if (USE_MOCK) return mockApi.clients.create(dto);
    return apiClient.post('/admin/clients', dto);
  },

  update: (id: string, dto: UpdateClientDto): Promise<void> => {
    if (USE_MOCK) return mockApi.clients.update(id, dto);
    return apiClient.put(`/admin/clients/${id}`, dto);
  },

  delete: (id: string): Promise<void> => {
    if (USE_MOCK) return mockApi.clients.delete(id);
    return apiClient.delete(`/admin/clients/${id}`);
  },
};
