import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { groupApi } from '../api/groupApi';

export function useAddGroupRole(groupId: string) {
  const queryClient = useQueryClient();
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useMutation({
    mutationFn: (roleId: string) => groupApi.addRole(tenantCode!, groupId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.groups.roles(tenantCode ?? '', groupId),
      });
      message.success('Role added to group successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to add role: ${error.message}`);
    },
  });
}
