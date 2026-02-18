import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { roleApi } from '../api/roleApi';
import type { UpdateRoleDto } from '@/types/role.types';

export function useUpdateRole(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpdateRoleDto) => roleApi.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.roles.all });
      message.success('Role updated successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to update role: ${error.message}`);
    },
  });
}
