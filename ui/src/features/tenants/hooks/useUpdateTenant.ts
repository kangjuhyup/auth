import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { tenantApi } from '../api/tenantApi';
import type { UpdateTenantDto } from '@/types/tenant.types';

export function useUpdateTenant(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpdateTenantDto) => tenantApi.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.tenants.all });
      message.success('Tenant updated successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to update tenant: ${error.message}`);
    },
  });
}
