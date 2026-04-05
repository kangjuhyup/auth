import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { clientApi } from '../api/clientApi';
import type { UpdateClientDto } from '@/types/client.types';

export function useUpdateClient(id: string) {
  const queryClient = useQueryClient();
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useMutation({
    mutationFn: (dto: UpdateClientDto) => clientApi.update(tenantCode!, id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.clients.all });
      message.success('Client updated successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to update client: ${error.message}`);
    },
  });
}
