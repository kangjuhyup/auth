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
import { AuditContext, TenantContext } from '@application/dto';
import { Tenant } from '../../http/tenant.decorator';
import { AdminAuditContext } from '@presentation/http/admin-audit-context.decorator';

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
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<{ id: string }> {
    if (!auditContext) {
      return this.commandPort.createIdentityProvider(tenant.id, dto);
    }
    return this.commandPort.createIdentityProvider(
      tenant.id,
      dto,
      auditContext,
    );
  }

  @Put(':id')
  update(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateIdentityProviderDto,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    if (!auditContext) {
      return this.commandPort.updateIdentityProvider(tenant.id, id, dto);
    }
    return this.commandPort.updateIdentityProvider(
      tenant.id,
      id,
      dto,
      auditContext,
    );
  }

  @Delete(':id')
  delete(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    if (!auditContext) {
      return this.commandPort.deleteIdentityProvider(tenant.id, id);
    }
    return this.commandPort.deleteIdentityProvider(tenant.id, id, auditContext);
  }
}
