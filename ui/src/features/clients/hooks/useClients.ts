import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { clientApi } from '../api/clientApi';

export function useClients(params: { page?: number; limit?: number }) {
  const tenantId = useTenantStore((state) => state.selectedTenant?.id);

  return useQuery({
    queryKey: queryKeys.admin.clients.list(tenantId ?? '', params),
    queryFn: () => clientApi.list(params),
    enabled: !!tenantId,
  });
}
