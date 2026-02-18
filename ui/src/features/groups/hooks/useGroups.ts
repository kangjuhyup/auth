import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { groupApi } from '../api/groupApi';

export function useGroups(params: { page?: number; limit?: number }) {
  const tenantId = useTenantStore((state) => state.selectedTenant?.id);

  return useQuery({
    queryKey: queryKeys.admin.groups.list(tenantId ?? '', params),
    queryFn: () => groupApi.list(params),
    enabled: !!tenantId,
  });
}
