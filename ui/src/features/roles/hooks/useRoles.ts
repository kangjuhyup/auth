import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { roleApi } from '../api/roleApi';

export function useRoles(params: { page?: number; limit?: number }) {
  const tenantId = useTenantStore((state) => state.selectedTenant?.id);

  return useQuery({
    queryKey: queryKeys.admin.roles.list(tenantId ?? '', params),
    queryFn: () => roleApi.list(params),
    enabled: !!tenantId,
  });
}
