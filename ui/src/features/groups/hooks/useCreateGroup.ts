import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { groupApi } from '../api/groupApi';
import type { CreateGroupDto } from '@/types/group.types';

export function useCreateGroup() {
  const queryClient = useQueryClient();
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useMutation({
    mutationFn: (dto: CreateGroupDto) => groupApi.create(tenantCode!, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.groups.all });
      message.success('Group created successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to create group: ${error.message}`);
    },
  });
}
