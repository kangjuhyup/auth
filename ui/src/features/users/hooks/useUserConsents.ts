import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { userApi } from '../api/userApi';

export function useUserConsents(
  userId: string,
  params: { page?: number; limit?: number },
) {
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useQuery({
    queryKey: queryKeys.admin.users.consents(tenantCode ?? '', userId, params),
    queryFn: () => userApi.getConsents(tenantCode!, userId, params),
    enabled: !!tenantCode && !!userId,
  });
}
