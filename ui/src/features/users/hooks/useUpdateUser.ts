import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { userApi } from '../api/userApi';
import type { UpdateUserDto } from '@/types/user.types';

export function useUpdateUser(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpdateUserDto) => userApi.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.all });
      message.success('User updated successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to update user: ${error.message}`);
    },
  });
}
