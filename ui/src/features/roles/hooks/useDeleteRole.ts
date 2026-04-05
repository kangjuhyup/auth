import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { roleApi } from '../api/roleApi';

export function useDeleteRole() {
  const queryClient = useQueryClient();
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useMutation({
    mutationFn: (id: string) => roleApi.delete(tenantCode!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.roles.all });
      message.success('Role deleted successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to delete role: ${error.message}`);
    },
  });
}
