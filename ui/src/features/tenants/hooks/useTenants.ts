import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { tenantApi } from '../api/tenantApi';

export function useTenants(params: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.admin.tenants.list(params),
    queryFn: () => tenantApi.list(params),
  });
}
