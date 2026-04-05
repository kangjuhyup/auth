import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { groupApi } from '../api/groupApi';

export function useGroups(params: { page?: number; limit?: number }) {
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useQuery({
    queryKey: queryKeys.admin.groups.list(tenantCode ?? '', params),
    queryFn: () => groupApi.list(tenantCode!, params),
    enabled: !!tenantCode,
  });
}
