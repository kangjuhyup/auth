import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '@presentation/http/admin.guard';
import { KeyCommandPort } from '@application/commands/ports/key-command.port';
import { AdminQueryPort } from '@application/queries/ports';
import { AuditContext, TenantContext } from '@application/dto';
import { Tenant } from '../../http/tenant.decorator';
import { AdminAuditContext } from '@presentation/http/admin-audit-context.decorator';
import {
  ApiAdminResource,
  ApiNoContentSchema,
  ApiOkArraySchema,
  OpenApiResponseSchemas,
} from '@presentation/openapi-response';

@UseGuards(AdminGuard)
@ApiAdminResource('Admin Keys')
@Controller('t/:tenantCode/admin/keys')
export class AdminKeyController {
  constructor(
    private readonly commandPort: KeyCommandPort,
    private readonly queryPort: AdminQueryPort,
  ) {}

  @Get()
  @ApiOkArraySchema('List active keys', OpenApiResponseSchemas.key)
  list(@Tenant() tenant: TenantContext): Promise<unknown[]> {
    return this.queryPort.getKeys(tenant.id);
  }

  @Post('rotate')
  @ApiNoContentSchema('Rotate keys')
  rotate(
    @Tenant() tenant: TenantContext,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    if (!auditContext) return this.commandPort.rotateKeys(tenant.id);
    return this.commandPort.rotateKeys(tenant.id, auditContext);
  }
}
