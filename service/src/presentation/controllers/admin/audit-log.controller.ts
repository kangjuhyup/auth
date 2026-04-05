import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '@presentation/http/admin.guard';
import { AdminQueryPort } from '@application/queries/ports';
import { PaginationQuery, PaginatedResult } from '@presentation/dto';
import { TenantContext } from '@application/dto';
import { Tenant } from '../../http/tenant.decorator';

@UseGuards(AdminGuard)
@Controller('t/:tenantCode/admin/audit-logs')
export class AdminAuditLogController {
  constructor(private readonly queryPort: AdminQueryPort) {}

  @Get()
  list(
    @Tenant() tenant: TenantContext,
    @Query() query: PaginationQuery,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    return this.queryPort.getAuditLogs(tenant.id, query);
  }
}
