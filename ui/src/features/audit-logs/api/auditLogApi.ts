import { apiClient } from '@/lib/apiClient';
import { mockApi } from '@/lib/mockApi';
import type { PaginatedResult } from '@/types/pagination.types';
import type {
  AuditLogFilters,
  AuditLogResponse,
} from '@/types/audit-log.types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

export const auditLogApi = {
  list: (
    tenantCode: string,
    params: AuditLogFilters,
  ): Promise<PaginatedResult<AuditLogResponse>> => {
    if (USE_MOCK) return mockApi.auditLogs.list(params);
    const queryParams: Record<
      string,
      string | number | boolean | null | undefined
    > = {
      ...params,
    };
    return apiClient.get(`/t/${tenantCode}/admin/audit-logs`, {
      params: queryParams,
    });
  },
};
