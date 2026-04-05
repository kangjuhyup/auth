import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { clientApi } from '../api/clientApi';

export function useClients(params: { page?: number; limit?: number }) {
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useQuery({
    queryKey: queryKeys.admin.clients.list(tenantCode ?? '', params),
    queryFn: () => clientApi.list(tenantCode!, params),
    enabled: !!tenantCode,
  });
}
