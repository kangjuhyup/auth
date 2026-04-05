import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { roleApi } from '../api/roleApi';

export function useRoles(params: { page?: number; limit?: number }) {
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useQuery({
    queryKey: queryKeys.admin.roles.list(tenantCode ?? '', params),
    queryFn: () => roleApi.list(tenantCode!, params),
    enabled: !!tenantCode,
  });
}
