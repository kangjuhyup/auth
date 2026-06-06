import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { clientApi } from '../api/clientApi';
import type { UpdateClientAuthPolicyDto } from '@/types/client.types';

export function useUpdateClientAuthPolicy(clientId: string) {
  const queryClient = useQueryClient();
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useMutation({
    mutationFn: (dto: UpdateClientAuthPolicyDto) =>
      clientApi.updateAuthPolicy(tenantCode!, clientId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.clients.authPolicy(tenantCode ?? '', clientId),
      });
      message.success('Client policy updated successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to update client policy: ${error.message}`);
    },
  });
}
