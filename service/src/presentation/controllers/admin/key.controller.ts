import { Controller, Get, Post, Inject } from '@nestjs/common';
import {
  KEY_COMMAND_PORT,
  KeyCommandPort,
} from '@application/commands/ports/key-command.port';
import { ADMIN_QUERY_PORT, AdminQueryPort } from '@application/queries/ports';
import { TenantContext } from '@application/dto';
import { Tenant } from '../../http/tenant.decorator';

@Controller('admin/keys')
export class AdminKeyController {
  constructor(
    @Inject(KEY_COMMAND_PORT) private readonly commandPort: KeyCommandPort,
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
