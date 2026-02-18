import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { roleApi } from '../api/roleApi';
import type { CreateRoleDto } from '@/types/role.types';

export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateRoleDto) => roleApi.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.roles.all });
      message.success('Role created successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to create role: ${error.message}`);
    },
  });
}
