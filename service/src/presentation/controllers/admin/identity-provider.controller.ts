import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '@presentation/http/admin.guard';
import { IdentityProviderCommandPort } from '@application/commands/ports/identity-provider-command.port';
import { AdminQueryPort } from '@application/queries/ports';
import type { IdentityProviderResponse } from '@application/dto';
import {
  CreateIdentityProviderDto,
  UpdateIdentityProviderDto,
  PaginationQuery,
  PaginatedResult,
} from '@presentation/dto';
import { TenantContext } from '@application/dto';
import { Tenant } from '../../http/tenant.decorator';

@UseGuards(AdminGuard)
@Controller('t/:tenantCode/admin/identity-providers')
export class AdminIdentityProviderController {
  constructor(
    private readonly commandPort: IdentityProviderCommandPort,
    private readonly queryPort: AdminQueryPort,
  ) {}

  @Get()
  list(
    @Tenant() tenant: TenantContext,
    @Query() query: PaginationQuery,
  ): Promise<PaginatedResult<IdentityProviderResponse>> {
    return this.queryPort.getIdentityProviders(tenant.id, query);
  }

  @Get(':id')
  get(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<IdentityProviderResponse> {
    return this.queryPort.getIdentityProvider(tenant.id, id);
  }

  @Post()
  create(
    @Tenant() tenant: TenantContext,
    @Body() dto: CreateIdentityProviderDto,
  ): Promise<{ id: string }> {
    return this.commandPort.createIdentityProvider(tenant.id, dto);
  }

  @Put(':id')
  update(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateIdentityProviderDto,
  ): Promise<void> {
    return this.commandPort.updateIdentityProvider(tenant.id, id, dto);
  }

  @Delete(':id')
  delete(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<void> {
    return this.commandPort.deleteIdentityProvider(tenant.id, id);
  }
}
