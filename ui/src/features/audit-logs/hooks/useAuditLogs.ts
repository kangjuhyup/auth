import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import type { AuditLogFilters } from '@/types/audit-log.types';
import { auditLogApi } from '../api/auditLogApi';

export function useAuditLogs(params: AuditLogFilters) {
  const tenantCode = useTenantStore((state) => state.selectedTenant?.code);

  return useQuery({
    queryKey: queryKeys.admin.auditLogs.list(tenantCode ?? '', params),
    queryFn: () => auditLogApi.list(tenantCode!, params),
    enabled: !!tenantCode,
  });
}
