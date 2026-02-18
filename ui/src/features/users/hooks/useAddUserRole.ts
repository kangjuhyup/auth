import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { userApi } from '../api/userApi';

export function useAddUserRole(userId: string) {
  const queryClient = useQueryClient();
  const tenantId = useTenantStore((state) => state.selectedTenant?.id);

  return useMutation({
    mutationFn: (roleId: string) => userApi.addRole(userId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.users.roles(tenantId ?? '', userId),
      });
      message.success('Role added to user successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to add role: ${error.message}`);
    },
  });
}
