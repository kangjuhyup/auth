import { Controller, Get, Post, Inject } from '@nestjs/common';
import {
  ADMIN_COMMAND_PORT,
  AdminCommandPort,
} from '@application/command/commands/ports/admin-command.port';
import { ADMIN_QUERY_PORT, AdminQueryPort } from '@application/query/ports';
import { TenantContext } from '@application/dto';
import { Tenant } from '../../http/tenant.decorator';

@Controller('admin/keys')
export class AdminKeyController {
  constructor(
    @Inject(ADMIN_COMMAND_PORT) private readonly commandPort: AdminCommandPort,
    @Inject(ADMIN_QUERY_PORT) private readonly queryPort: AdminQueryPort,
  ) {}

  @Get()
  list(@Tenant() tenant: TenantContext): Promise<unknown[]> {
    return this.queryPort.getKeys(tenant.id);
  }

  @Post('rotate')
  rotate(@Tenant() tenant: TenantContext): Promise<void> {
    return this.commandPort.rotateKeys(tenant.id);
  }
}
