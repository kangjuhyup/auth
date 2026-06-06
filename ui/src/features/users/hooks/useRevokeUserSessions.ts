import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import { userApi } from '../api/userApi';

export function useRevokeUserSessions(userId: string) {
  const queryClient = useQueryClient();
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useMutation({
    mutationFn: () => userApi.revokeSessions(tenantCode!, userId),
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
