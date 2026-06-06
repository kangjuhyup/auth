import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { policyApi } from '../api/policyApi';

export function useTenantPolicies() {
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useQuery({
    queryKey: queryKeys.admin.policies.tenant(tenantCode ?? ''),
    queryFn: () => policyApi.getTenantPolicies(tenantCode!),
    enabled: Boolean(tenantCode),
  });
}
