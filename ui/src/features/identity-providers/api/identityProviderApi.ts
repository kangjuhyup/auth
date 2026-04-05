import { apiClient } from '@/lib/apiClient';
import type { PaginatedResult } from '@/types/pagination.types';
import type {
  IdentityProviderResponse,
  CreateIdentityProviderDto,
  UpdateIdentityProviderDto,
} from '@/types/identity-provider.types';

export const identityProviderApi = {
  list: (
    tenantCode: string,
    params: { page?: number; limit?: number },
  ): Promise<PaginatedResult<IdentityProviderResponse>> =>
    apiClient.get(`/t/${tenantCode}/admin/identity-providers`, { params }),

  get: (tenantCode: string, id: string): Promise<IdentityProviderResponse> =>
    apiClient.get(`/t/${tenantCode}/admin/identity-providers/${id}`),

  create: (
    tenantCode: string,
    dto: CreateIdentityProviderDto,
  ): Promise<{ id: string }> =>
    apiClient.post(`/t/${tenantCode}/admin/identity-providers`, dto),

  update: (
    tenantCode: string,
    id: string,
    dto: UpdateIdentityProviderDto,
  ): Promise<void> =>
    apiClient.put(`/t/${tenantCode}/admin/identity-providers/${id}`, dto),

  delete: (tenantCode: string, id: string): Promise<void> =>
    apiClient.delete(`/t/${tenantCode}/admin/identity-providers/${id}`),
};
