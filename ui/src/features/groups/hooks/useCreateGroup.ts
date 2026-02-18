import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { groupApi } from '../api/groupApi';
import type { CreateGroupDto } from '@/types/group.types';

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateGroupDto) => groupApi.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.groups.all });
      message.success('Group created successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to create group: ${error.message}`);
    },
  });
}
