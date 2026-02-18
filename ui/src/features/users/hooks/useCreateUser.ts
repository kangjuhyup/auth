import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { userApi } from '../api/userApi';
import type { CreateUserDto } from '@/types/user.types';

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateUserDto) => userApi.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.all });
      message.success('User created successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to create user: ${error.message}`);
    },
  });
}
