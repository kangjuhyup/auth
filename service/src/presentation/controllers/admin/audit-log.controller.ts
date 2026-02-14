import { Controller, Get, Query, Inject } from '@nestjs/common';
import { ADMIN_QUERY_PORT, AdminQueryPort } from '@application/queries/ports';
import {
  PaginationQuery,
  PaginatedResult,
  TenantContext,
} from '@application/dto';
import { Tenant } from '../../http/tenant.decorator';

@Controller('admin/audit-logs')
export class AdminAuditLogController {
  constructor(
    @Inject(ADMIN_QUERY_PORT) private readonly queryPort: AdminQueryPort,
  ) {}

  @Get()
  list(
    @Tenant() tenant: TenantContext,
    @Query() query: PaginationQuery,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    return this.queryPort.getAuditLogs(tenant.id, query);
  }
}
