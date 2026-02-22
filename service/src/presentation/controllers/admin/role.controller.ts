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
  ROLE_COMMAND_PORT,
  RoleCommandPort,
} from '@application/commands/ports/role-command.port';
import { ADMIN_QUERY_PORT, AdminQueryPort } from '@application/queries/ports';
import {
  CreateRoleDto,
  UpdateRoleDto,
  RoleResponse,
  PaginationQuery,
  PaginatedResult,
} from '@presentation/dto';
import { TenantContext } from '@application/dto';
import { Tenant } from '../../http/tenant.decorator';

@Controller('admin/roles')
export class AdminRoleController {
  constructor(
    @Inject(ROLE_COMMAND_PORT) private readonly commandPort: RoleCommandPort,
    @Inject(ADMIN_QUERY_PORT) private readonly queryPort: AdminQueryPort,
  ) {}

  @Get()
  list(
    @Tenant() tenant: TenantContext,
    @Query() query: PaginationQuery,
  ): Promise<PaginatedResult<RoleResponse>> {
    return this.queryPort.getRoles(tenant.id, query);
  }

  @Get(':id')
  get(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<RoleResponse> {
    return this.queryPort.getRole(tenant.id, id);
  }

  @Post()
  create(
    @Tenant() tenant: TenantContext,
    @Body() dto: CreateRoleDto,
  ): Promise<{ id: string }> {
    return this.commandPort.createRole(tenant.id, dto);
  }

  @Put(':id')
  update(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<void> {
    return this.commandPort.updateRole(tenant.id, id, dto);
  }

  @Delete(':id')
  delete(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<void> {
    return this.commandPort.deleteRole(tenant.id, id);
  }
}
