import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { clientApi } from '../api/clientApi';

export function useDeleteClient() {
  const queryClient = useQueryClient();
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useMutation({
    mutationFn: (id: string) => clientApi.delete(tenantCode!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.clients.all });
      message.success('Client deleted successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to delete client: ${error.message}`);
    },
  });
}
