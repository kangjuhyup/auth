import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { userApi } from '../api/userApi';

export function useRevokeUserSession(userId: string) {
  const queryClient = useQueryClient();
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useMutation({
    mutationFn: (sessionId: string) =>
      userApi.revokeSession(tenantCode!, userId, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.users.sessions(tenantCode ?? '', userId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.auditLogs.all,
      });
    },
  });
}
