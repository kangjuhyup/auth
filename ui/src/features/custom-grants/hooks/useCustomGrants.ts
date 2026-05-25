import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { customGrantApi } from '../api/customGrantApi';

export function useCustomGrants(params: { page?: number; limit?: number }) {
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useQuery({
    queryKey: queryKeys.admin.customGrants.list(tenantCode ?? '', params),
    queryFn: () => customGrantApi.list(tenantCode!, params),
    enabled: !!tenantCode,
  });
}
