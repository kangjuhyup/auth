import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Inject,
} from '@nestjs/common';
import {
  ADMIN_COMMAND_PORT,
  AdminCommandPort,
} from '@application/commands/ports/admin-command.port';
import { ADMIN_QUERY_PORT, AdminQueryPort } from '@application/queries/ports';
import {
  CreateClientDto,
  UpdateClientDto,
  ClientResponse,
  PaginationQuery,
  PaginatedResult,
  TenantContext,
} from '@application/dto';
import { Tenant } from '../../http/tenant.decorator';

@Controller('admin/clients')
export class AdminClientController {
  constructor(
    @Inject(ADMIN_COMMAND_PORT) private readonly commandPort: AdminCommandPort,
    @Inject(ADMIN_QUERY_PORT) private readonly queryPort: AdminQueryPort,
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
  ): Promise<{ id: string }> {
    return this.commandPort.createClient(tenant.id, dto);
  }

  @Put(':id')
  update(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ): Promise<void> {
    return this.commandPort.updateClient(tenant.id, id, dto);
  }

  @Delete(':id')
  delete(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<void> {
    return this.commandPort.deleteClient(tenant.id, id);
  }
}
