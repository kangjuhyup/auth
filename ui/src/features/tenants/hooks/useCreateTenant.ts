import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { tenantApi } from '../api/tenantApi';
import type { CreateTenantDto } from '@/types/tenant.types';

export function useCreateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateTenantDto) => tenantApi.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.tenants.all });
      message.success('Tenant created successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to create tenant: ${error.message}`);
    },
  });
}
