import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { roleApi } from '../api/roleApi';
import type { UpdateRoleDto } from '@/types/role.types';

export function useUpdateRole(id: string) {
  const queryClient = useQueryClient();
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useMutation({
    mutationFn: (dto: UpdateRoleDto) => roleApi.update(tenantCode!, id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.roles.all });
      message.success('Role updated successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to update role: ${error.message}`);
    },
  });
}
