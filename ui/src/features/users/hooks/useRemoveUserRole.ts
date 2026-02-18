import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { userApi } from '../api/userApi';

export function useRemoveUserRole(userId: string) {
  const queryClient = useQueryClient();
  const tenantId = useTenantStore((state) => state.selectedTenant?.id);

  return useMutation({
    mutationFn: (roleId: string) => userApi.removeRole(userId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.users.roles(tenantId ?? '', userId),
      });
      message.success('Role removed from user successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to remove role: ${error.message}`);
    },
  });
}
