import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { customGrantApi } from '../api/customGrantApi';
import type { CreateCustomGrantDto } from '@/types/custom-grant.types';

export function useCreateCustomGrant() {
  const queryClient = useQueryClient();
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useMutation({
    mutationFn: (dto: CreateCustomGrantDto) =>
      customGrantApi.create(tenantCode!, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.customGrants.all,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.clients.all });
      message.success('Custom grant created successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to create custom grant: ${error.message}`);
    },
  });
}
