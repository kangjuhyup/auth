import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { userApi } from '../api/userApi';

export function useAddUserRole(userId: string) {
  const queryClient = useQueryClient();
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useMutation({
    mutationFn: (roleId: string) => userApi.addRole(tenantCode!, userId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.users.roles(tenantCode ?? '', userId),
      });
      message.success('Role added to user successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to add role: ${error.message}`);
    },
  });
}
