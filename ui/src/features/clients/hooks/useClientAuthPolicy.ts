import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { clientApi } from '../api/clientApi';

export function useClientAuthPolicy(clientId: string | null) {
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useQuery({
    queryKey: queryKeys.admin.clients.authPolicy(
      tenantCode ?? '',
      clientId ?? '',
    ),
    queryFn: () => clientApi.getAuthPolicy(tenantCode!, clientId!),
    enabled: Boolean(tenantCode && clientId),
  });
}
