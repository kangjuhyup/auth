import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { roleApi } from '../api/roleApi';
import type { CreateRoleDto } from '@/types/role.types';

export function useCreateRole() {
  const queryClient = useQueryClient();
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useMutation({
    mutationFn: (dto: CreateRoleDto) => roleApi.create(tenantCode!, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.roles.all });
      message.success('Role created successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to create role: ${error.message}`);
    },
  });
}
