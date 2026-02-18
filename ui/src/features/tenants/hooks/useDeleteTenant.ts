import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '@/lib/queryKeys';
import { tenantApi } from '../api/tenantApi';

export function useDeleteTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tenantApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.tenants.all });
      message.success('Tenant deleted successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to delete tenant: ${error.message}`);
    },
  });
}
