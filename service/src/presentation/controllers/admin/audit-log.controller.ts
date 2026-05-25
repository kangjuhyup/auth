import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '@presentation/http/admin.guard';
import { AdminQueryPort } from '@application/queries/ports';
import { PaginatedResult } from '@presentation/dto';
import {
  AuditLogQuery,
  AuditLogResponse,
} from '@presentation/dto/admin/audit-log.dto';
import { TenantContext } from '@application/dto';
import { Tenant } from '../../http/tenant.decorator';
import {
  ApiAdminResource,
  ApiPaginatedSchema,
  OpenApiResponseSchemas,
} from '@presentation/openapi-response';

@UseGuards(AdminGuard)
@ApiAdminResource('Admin Audit Logs')
@Controller('t/:tenantCode/admin/audit-logs')
export class AdminAuditLogController {
  constructor(private readonly queryPort: AdminQueryPort) {}

  @Get()
  @ApiPaginatedSchema('List audit logs', OpenApiResponseSchemas.auditLog)
  list(
    @Tenant() tenant: TenantContext,
    @Query() query: AuditLogQuery,
  ): Promise<PaginatedResult<AuditLogResponse>> {
    return this.queryPort.getAuditLogs(tenant.id, query);
  }
}
