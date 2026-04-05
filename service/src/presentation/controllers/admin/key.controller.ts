import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '@presentation/http/admin.guard';
import { KeyCommandPort } from '@application/commands/ports/key-command.port';
import { AdminQueryPort } from '@application/queries/ports';
import { TenantContext } from '@application/dto';
import { Tenant } from '../../http/tenant.decorator';

@UseGuards(AdminGuard)
@Controller('t/:tenantCode/admin/keys')
export class AdminKeyController {
  constructor(
    private readonly commandPort: KeyCommandPort,
    private readonly queryPort: AdminQueryPort,
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
