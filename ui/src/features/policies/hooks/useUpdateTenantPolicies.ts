import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { policyApi } from '../api/policyApi';
import type { UpdateTenantPoliciesDto } from '@/types/policy.types';

export function useUpdateTenantPolicies() {
  const queryClient = useQueryClient();
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useMutation({
    mutationFn: (dto: UpdateTenantPoliciesDto) =>
      policyApi.updateTenantPolicies(tenantCode!, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.policies.tenant(tenantCode ?? ''),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.clients.all });
      message.success('Tenant policies updated successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to update tenant policies: ${error.message}`);
    },
  });
}
