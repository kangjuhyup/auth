import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { groupApi } from '../api/groupApi';

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useMutation({
    mutationFn: (id: string) => groupApi.delete(tenantCode!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.groups.all });
      message.success('Group deleted successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to delete group: ${error.message}`);
    },
  });
}
