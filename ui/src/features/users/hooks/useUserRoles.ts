import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { userApi } from '../api/userApi';

export function useUserRoles(userId: string) {
  const tenantId = useTenantStore((state) => state.selectedTenant?.id);

  return useQuery({
    queryKey: queryKeys.admin.users.roles(tenantId ?? '', userId),
    queryFn: () => userApi.getRoles(userId),
    enabled: !!tenantId && !!userId,
  });
}
