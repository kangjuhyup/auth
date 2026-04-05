import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { clientApi } from '../api/clientApi';
import type { CreateClientDto } from '@/types/client.types';

export function useCreateClient() {
  const queryClient = useQueryClient();
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useMutation({
    mutationFn: (dto: CreateClientDto) => clientApi.create(tenantCode!, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.clients.all });
      message.success('Client created successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to create client: ${error.message}`);
    },
  });
}
