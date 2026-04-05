import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { groupApi } from '../api/groupApi';

export function useGroupRoles(groupId: string) {
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useQuery({
    queryKey: queryKeys.admin.groups.roles(tenantCode ?? '', groupId),
    queryFn: () => groupApi.getRoles(tenantCode!, groupId),
    enabled: !!tenantCode && !!groupId,
  });
}
