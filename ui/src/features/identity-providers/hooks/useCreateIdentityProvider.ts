import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { identityProviderApi } from '../api/identityProviderApi';
import type { CreateIdentityProviderDto } from '@/types/identity-provider.types';

export function useCreateIdentityProvider() {
  const queryClient = useQueryClient();
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useMutation({
    mutationFn: (dto: CreateIdentityProviderDto) =>
      identityProviderApi.create(tenantCode!, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.identityProviders.all });
      message.success('Identity provider created');
    },
    onError: (error: Error) => {
      message.error(error.message);
    },
  });
}
