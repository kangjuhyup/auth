import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { customGrantApi } from '../api/customGrantApi';

export function useDeleteCustomGrant() {
  const queryClient = useQueryClient();
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useMutation({
    mutationFn: (id: string) => customGrantApi.delete(tenantCode!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.customGrants.all,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.clients.all });
      message.success('Custom grant deleted successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to delete custom grant: ${error.message}`);
    },
  });
}
