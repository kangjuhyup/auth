import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { userApi } from '../api/userApi';

export function useUserRoles(userId: string) {
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useQuery({
    queryKey: queryKeys.admin.users.roles(tenantCode ?? '', userId),
    queryFn: () => userApi.getRoles(tenantCode!, userId),
    enabled: !!tenantCode && !!userId,
  });
}
