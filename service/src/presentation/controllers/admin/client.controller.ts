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
import {
  AuditContext,
  TenantContext,
  CreateClientDto as AppCreateClientDto,
  UpdateClientDto as AppUpdateClientDto,
  UpdateClientAuthPolicyDto as AppUpdateClientAuthPolicyDto,
  PaginationQuery as AppPaginationQuery,
} from '@application/dto';
import { Tenant } from '../../http/tenant.decorator';
import { AdminAuditContext } from '@presentation/http/admin-audit-context.decorator';
import {
  ApiAdminResource,
  ApiCreatedIdSchema,
  ApiNoContentSchema,
  ApiOkSchema,
  ApiPaginatedSchema,
  OpenApiResponseSchemas,
} from '@presentation/openapi-response';

@UseGuards(AdminGuard)
@ApiAdminResource('Admin Clients')
@Controller('t/:tenantCode/admin/clients')
export class AdminClientController {
  constructor(
    private readonly commandPort: ClientCommandPort,
    private readonly queryPort: AdminQueryPort,
  ) {}

  @Get()
  @ApiPaginatedSchema('List clients', OpenApiResponseSchemas.client)
  list(
    @Tenant() tenant: TenantContext,
    @Query() query: PaginationQuery,
  ): Promise<PaginatedResult<ClientResponse>> {
    return this.queryPort.getClients(tenant.id, AppPaginationQuery.of(query));
  }

  @Get(':id')
  @ApiOkSchema('Get client', OpenApiResponseSchemas.client)
  get(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<ClientResponse> {
    return this.queryPort.getClient(tenant.id, id);
  }

  @Post()
  @ApiCreatedIdSchema('Create client')
  create(
    @Tenant() tenant: TenantContext,
    @Body() dto: CreateClientDto,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<{ id: string }> {
    const command = AppCreateClientDto.of(dto);
    if (!auditContext) return this.commandPort.createClient(tenant.id, command);
    return this.commandPort.createClient(tenant.id, command, auditContext);
  }

  @Get(':id/auth-policy')
  @ApiOkSchema(
    'Get client auth policy',
    OpenApiResponseSchemas.clientAuthPolicy,
  )
  getAuthPolicy(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<ClientAuthPolicyResponse> {
    return this.queryPort.getClientAuthPolicy(tenant.id, id);
  }

  @Put(':id')
  @ApiNoContentSchema('Update client')
  update(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    const command = AppUpdateClientDto.of(dto);
    if (!auditContext) {
      return this.commandPort.updateClient(tenant.id, id, command);
    }
    return this.commandPort.updateClient(tenant.id, id, command, auditContext);
  }

  @Put(':id/auth-policy')
  @ApiNoContentSchema('Update client auth policy')
  updateAuthPolicy(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateClientAuthPolicyDto,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    const command = AppUpdateClientAuthPolicyDto.of(dto);
    if (!auditContext) {
      return this.commandPort.updateClientAuthPolicy(tenant.id, id, command);
    }
    return this.commandPort.updateClientAuthPolicy(
      tenant.id,
      id,
      command,
      auditContext,
    );
  }

  @Delete(':id')
  @ApiNoContentSchema('Delete client')
  delete(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    if (!auditContext) return this.commandPort.deleteClient(tenant.id, id);
    return this.commandPort.deleteClient(tenant.id, id, auditContext);
  }
}
