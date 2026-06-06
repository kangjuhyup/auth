import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { userApi } from '../api/userApi';

export function useUserConsentHistory(
  userId: string,
  params: { page?: number; limit?: number },
) {
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useQuery({
    queryKey: queryKeys.admin.users.consentHistory(
      tenantCode ?? '',
      userId,
      params,
    ),
    queryFn: () => userApi.getConsentHistory(tenantCode!, userId, params),
    enabled: !!tenantCode && !!userId,
  });
}
