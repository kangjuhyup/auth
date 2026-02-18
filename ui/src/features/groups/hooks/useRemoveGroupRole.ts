import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { groupApi } from '../api/groupApi';

export function useRemoveGroupRole(groupId: string) {
  const queryClient = useQueryClient();
  const tenantId = useTenantStore((state) => state.selectedTenant?.id);

  return useMutation({
    mutationFn: (roleId: string) => groupApi.removeRole(groupId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.groups.roles(tenantId ?? '', groupId),
      });
      message.success('Role removed from group successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to remove role: ${error.message}`);
    },
  });
}
