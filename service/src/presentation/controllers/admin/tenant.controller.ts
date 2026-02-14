import { Controller, Get, Post, Put, Delete, Body, Param, Query, Inject } from '@nestjs/common';
import {
  ADMIN_COMMAND_PORT,
  AdminCommandPort,
} from '@application/command/commands/ports/admin-command.port';
import { ADMIN_QUERY_PORT, AdminQueryPort } from '@application/query/ports';
import {
  CreateTenantDto,
  UpdateTenantDto,
  TenantResponse,
  PaginationQuery,
  PaginatedResult,
} from '@application/dto';

@Controller('admin/tenants')
export class AdminTenantController {
  constructor(
    @Inject(ADMIN_COMMAND_PORT) private readonly commandPort: AdminCommandPort,
    @Inject(ADMIN_QUERY_PORT) private readonly queryPort: AdminQueryPort,
  ) {}

  @Get()
  list(@Query() query: PaginationQuery): Promise<PaginatedResult<TenantResponse>> {
    return this.queryPort.getTenants(query);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<TenantResponse> {
    return this.queryPort.getTenant(id);
  }

  @Post()
  create(@Body() dto: CreateTenantDto): Promise<{ id: string }> {
    return this.commandPort.createTenant(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto): Promise<void> {
    return this.commandPort.updateTenant(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string): Promise<void> {
    return this.commandPort.deleteTenant(id);
  }
}
