import { Controller, Get, Put, Body, Inject } from '@nestjs/common';
import {
  ADMIN_COMMAND_PORT,
  AdminCommandPort,
} from '@application/commands/ports/admin-command.port';
import { ADMIN_QUERY_PORT, AdminQueryPort } from '@application/queries/ports';
import { TenantContext } from '@application/dto';
import { Tenant } from '../../http/tenant.decorator';

@Controller('admin/policies')
export class AdminPolicyController {
  constructor(
    @Inject(ADMIN_COMMAND_PORT) private readonly commandPort: AdminCommandPort,
    @Inject(ADMIN_QUERY_PORT) private readonly queryPort: AdminQueryPort,
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
