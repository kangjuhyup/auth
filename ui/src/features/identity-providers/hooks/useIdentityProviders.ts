import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { identityProviderApi } from '../api/identityProviderApi';

export function useIdentityProviders(params: { page?: number; limit?: number }) {
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useQuery({
    queryKey: queryKeys.admin.identityProviders.list(tenantCode ?? '', params),
    queryFn: () => identityProviderApi.list(tenantCode!, params),
    enabled: !!tenantCode,
  });
}
