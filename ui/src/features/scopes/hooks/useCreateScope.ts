import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { scopeApi } from '../api/scopeApi';
import type { CreateScopeDto } from '@/types/scope.types';

export function useCreateScope() {
  const queryClient = useQueryClient();
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useMutation({
    mutationFn: (dto: CreateScopeDto) => scopeApi.create(tenantCode!, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.scopes.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.clients.all });
      message.success('Scope created successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to create scope: ${error.message}`);
    },
  });
}
