import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { userApi } from '../api/userApi';

export function useUsers(params: { page?: number; limit?: number }) {
  const tenantId = useTenantStore((state) => state.selectedTenant?.id);

  return useQuery({
    queryKey: queryKeys.admin.users.list(tenantId ?? '', params),
    queryFn: () => userApi.list(params),
    enabled: !!tenantId,
  });
}
