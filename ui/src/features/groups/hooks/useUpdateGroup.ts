import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { groupApi } from '../api/groupApi';
import type { UpdateGroupDto } from '@/types/group.types';

export function useUpdateGroup(id: string) {
  const queryClient = useQueryClient();
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useMutation({
    mutationFn: (dto: UpdateGroupDto) => groupApi.update(tenantCode!, id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.groups.all });
      message.success('Group updated successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to update group: ${error.message}`);
    },
  });
}
