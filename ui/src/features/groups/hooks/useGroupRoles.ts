import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { groupApi } from '../api/groupApi';

export function useGroupRoles(groupId: string) {
  const tenantId = useTenantStore((state) => state.selectedTenant?.id);

  return useQuery({
    queryKey: queryKeys.admin.groups.roles(tenantId ?? '', groupId),
    queryFn: () => groupApi.getRoles(groupId),
    enabled: !!tenantId && !!groupId,
  });
}
