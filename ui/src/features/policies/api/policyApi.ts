import { apiClient } from '@/lib/apiClient';
import { mockApi } from '@/lib/mockApi';
import type {
  TenantPolicyResponse,
  UpdateTenantPoliciesDto,
} from '@/types/policy.types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

export const policyApi = {
  getTenantPolicies: (tenantCode: string): Promise<TenantPolicyResponse> =>
    USE_MOCK
      ? mockApi.policies.getTenantPolicies()
      : apiClient.get(`/t/${tenantCode}/admin/policies`),

  updateTenantPolicies: (
    tenantCode: string,
    dto: UpdateTenantPoliciesDto,
  ): Promise<void> =>
    USE_MOCK
      ? mockApi.policies.updateTenantPolicies(dto)
      : apiClient.put(`/t/${tenantCode}/admin/policies`, dto),
};
