import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { AdminGuard } from '@presentation/http/admin.guard';
import { PolicyCommandPort } from '@application/commands/ports/policy-command.port';
import { AdminQueryPort } from '@application/queries/ports';
import {
  AuditContext,
  TenantContext,
  type TenantPolicyResponse,
} from '@application/dto';
import { UpdateTenantPoliciesDto } from '@presentation/dto';
import { Tenant } from '../../http/tenant.decorator';
import { AdminAuditContext } from '@presentation/http/admin-audit-context.decorator';

@UseGuards(AdminGuard)
@Controller('t/:tenantCode/admin/policies')
export class AdminPolicyController {
  constructor(
    private readonly commandPort: PolicyCommandPort,
    private readonly queryPort: AdminQueryPort,
  ) {}

  @Get()
  list(@Tenant() tenant: TenantContext): Promise<TenantPolicyResponse> {
    return this.queryPort.getPolicies(tenant.id);
  }

  @Put()
  update(
    @Tenant() tenant: TenantContext,
    @Body() policies: UpdateTenantPoliciesDto | Record<string, unknown>,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    if (!auditContext) {
      return this.commandPort.updatePolicies(
        tenant.id,
        policies as UpdateTenantPoliciesDto,
      );
    }
    return this.commandPort.updatePolicies(
      tenant.id,
      policies as UpdateTenantPoliciesDto,
      auditContext,
    );
  }
}
