import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { userApi } from '../api/userApi';

export function useRemoveUserRole(userId: string) {
  const queryClient = useQueryClient();
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useMutation({
    mutationFn: (roleId: string) => userApi.removeRole(tenantCode!, userId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.users.roles(tenantCode ?? '', userId),
      });
      message.success('Role removed from user successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to remove role: ${error.message}`);
    },
  });
}
