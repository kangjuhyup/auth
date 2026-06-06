import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { scopeApi } from '../api/scopeApi';
import type { UpdateScopeDto } from '@/types/scope.types';

export function useUpdateScope(id: string) {
  const queryClient = useQueryClient();
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useMutation({
    mutationFn: (dto: UpdateScopeDto) => scopeApi.update(tenantCode!, id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.scopes.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.clients.all });
      message.success('Scope updated successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to update scope: ${error.message}`);
    },
  });
}
