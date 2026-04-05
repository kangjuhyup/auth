import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { identityProviderApi } from '../api/identityProviderApi';
import type { UpdateIdentityProviderDto } from '@/types/identity-provider.types';

export function useUpdateIdentityProvider(id: string) {
  const queryClient = useQueryClient();
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useMutation({
    mutationFn: (dto: UpdateIdentityProviderDto) =>
      identityProviderApi.update(tenantCode!, id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.identityProviders.all });
      message.success('Identity provider updated');
    },
    onError: (error: Error) => {
      message.error(error.message);
    },
  });
}
