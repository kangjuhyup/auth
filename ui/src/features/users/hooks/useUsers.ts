import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { userApi } from '../api/userApi';

export function useUsers(params: { page?: number; limit?: number }) {
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useQuery({
    queryKey: queryKeys.admin.users.list(tenantCode ?? '', params),
    queryFn: () => userApi.list(tenantCode!, params),
    enabled: !!tenantCode,
  });
}
