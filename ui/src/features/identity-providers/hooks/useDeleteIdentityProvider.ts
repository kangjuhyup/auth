import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { identityProviderApi } from '../api/identityProviderApi';

export function useDeleteIdentityProvider() {
  const queryClient = useQueryClient();
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useMutation({
    mutationFn: (id: string) => identityProviderApi.delete(tenantCode!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.identityProviders.all });
      message.success('Identity provider deleted');
    },
    onError: (error: Error) => {
      message.error(error.message);
    },
  });
}
