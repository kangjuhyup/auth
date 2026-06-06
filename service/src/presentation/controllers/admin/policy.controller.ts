import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { AdminGuard } from '@presentation/http/admin.guard';
import { PolicyCommandPort } from '@application/commands/ports/policy-command.port';
import { AdminQueryPort } from '@application/queries/ports';
import {
  AuditContext,
  TenantContext,
  UpdateTenantPoliciesDto as AppUpdateTenantPoliciesDto,
  type TenantPolicyResponse,
} from '@application/dto';
import { UpdateTenantPoliciesDto } from '@presentation/dto';
import { Tenant } from '../../http/tenant.decorator';
import { AdminAuditContext } from '@presentation/http/admin-audit-context.decorator';
import {
  ApiAdminResource,
  ApiNoContentSchema,
  ApiOkSchema,
  OpenApiResponseSchemas,
} from '@presentation/openapi-response';

@UseGuards(AdminGuard)
@ApiAdminResource('Admin Policies')
@Controller('t/:tenantCode/admin/policies')
export class AdminPolicyController {
  constructor(
    private readonly commandPort: PolicyCommandPort,
    private readonly queryPort: AdminQueryPort,
  ) {}

  @Get()
  @ApiOkSchema('Get tenant policies', OpenApiResponseSchemas.tenantPolicy)
  list(@Tenant() tenant: TenantContext): Promise<TenantPolicyResponse> {
    return this.queryPort.getPolicies(tenant.id);
  }

  @Put()
  @ApiNoContentSchema('Update tenant policies')
  update(
    @Tenant() tenant: TenantContext,
    @Body() policies: UpdateTenantPoliciesDto | Record<string, unknown>,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    const command = AppUpdateTenantPoliciesDto.of(
      policies as UpdateTenantPoliciesDto,
    );
    if (!auditContext) {
      return this.commandPort.updatePolicies(tenant.id, command);
    }
    return this.commandPort.updatePolicies(tenant.id, command, auditContext);
  }
}
