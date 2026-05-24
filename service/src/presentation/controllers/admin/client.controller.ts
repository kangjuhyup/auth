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
import { ClientCommandPort } from '@application/commands/ports/client-command.port';
import { AdminQueryPort } from '@application/queries/ports';
import {
  CreateClientDto,
  UpdateClientDto,
  UpdateClientAuthPolicyDto,
  ClientResponse,
  ClientAuthPolicyResponse,
  PaginationQuery,
  PaginatedResult,
} from '@presentation/dto';
import { AuditContext, TenantContext } from '@application/dto';
import { Tenant } from '../../http/tenant.decorator';
import { AdminAuditContext } from '@presentation/http/admin-audit-context.decorator';

@UseGuards(AdminGuard)
@Controller('t/:tenantCode/admin/clients')
export class AdminClientController {
  constructor(
    private readonly commandPort: ClientCommandPort,
    private readonly queryPort: AdminQueryPort,
  ) {}

  @Get()
  list(
    @Tenant() tenant: TenantContext,
    @Query() query: PaginationQuery,
  ): Promise<PaginatedResult<ClientResponse>> {
    return this.queryPort.getClients(tenant.id, query);
  }

  @Get(':id')
  get(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<ClientResponse> {
    return this.queryPort.getClient(tenant.id, id);
  }

  @Post()
  create(
    @Tenant() tenant: TenantContext,
    @Body() dto: CreateClientDto,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<{ id: string }> {
    if (!auditContext) return this.commandPort.createClient(tenant.id, dto);
    return this.commandPort.createClient(tenant.id, dto, auditContext);
  }

  @Get(':id/auth-policy')
  getAuthPolicy(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<ClientAuthPolicyResponse> {
    return this.queryPort.getClientAuthPolicy(tenant.id, id);
  }

  @Put(':id')
  update(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    if (!auditContext) return this.commandPort.updateClient(tenant.id, id, dto);
    return this.commandPort.updateClient(tenant.id, id, dto, auditContext);
  }

  @Put(':id/auth-policy')
  updateAuthPolicy(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateClientAuthPolicyDto,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    if (!auditContext) {
      return this.commandPort.updateClientAuthPolicy(tenant.id, id, dto);
    }
    return this.commandPort.updateClientAuthPolicy(
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
    if (!auditContext) return this.commandPort.deleteClient(tenant.id, id);
    return this.commandPort.deleteClient(tenant.id, id, auditContext);
  }
}
