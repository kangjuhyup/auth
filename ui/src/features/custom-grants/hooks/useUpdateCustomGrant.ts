import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { customGrantApi } from '../api/customGrantApi';
import type { UpdateCustomGrantDto } from '@/types/custom-grant.types';

export function useUpdateCustomGrant(id: string) {
  const queryClient = useQueryClient();
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useMutation({
    mutationFn: (dto: UpdateCustomGrantDto) =>
      customGrantApi.update(tenantCode!, id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.customGrants.all,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.clients.all });
      message.success('Custom grant updated successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to update custom grant: ${error.message}`);
    },
  });
}
