import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { userApi } from '../api/userApi';
import type { UpdateUserDto } from '@/types/user.types';

export function useUpdateUser(id: string) {
  const queryClient = useQueryClient();
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useMutation({
    mutationFn: (dto: UpdateUserDto) => userApi.update(tenantCode!, id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.all });
      message.success('User updated successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to update user: ${error.message}`);
    },
  });
}
