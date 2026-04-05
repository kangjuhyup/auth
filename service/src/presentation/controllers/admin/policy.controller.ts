import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { AdminGuard } from '@presentation/http/admin.guard';
import { PolicyCommandPort } from '@application/commands/ports/policy-command.port';
import { AdminQueryPort } from '@application/queries/ports';
import { TenantContext } from '@application/dto';
import { Tenant } from '../../http/tenant.decorator';

@UseGuards(AdminGuard)
@Controller('t/:tenantCode/admin/policies')
export class AdminPolicyController {
  constructor(
    private readonly commandPort: PolicyCommandPort,
    private readonly queryPort: AdminQueryPort,
  ) {}

  @Get()
  list(@Tenant() tenant: TenantContext): Promise<Record<string, unknown>> {
    return this.queryPort.getPolicies(tenant.id);
  }

  @Put()
  update(
    @Tenant() tenant: TenantContext,
    @Body() policies: Record<string, unknown>,
  ): Promise<void> {
    return this.commandPort.updatePolicies(tenant.id, policies);
  }
}
