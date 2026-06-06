import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { scopeApi } from '../api/scopeApi';

export function useDeleteScope() {
  const queryClient = useQueryClient();
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useMutation({
    mutationFn: (id: string) => scopeApi.delete(tenantCode!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.scopes.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.clients.all });
      message.success('Scope deleted successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to delete scope: ${error.message}`);
    },
  });
}
