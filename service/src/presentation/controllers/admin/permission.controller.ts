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
  PERMISSION_COMMAND_PORT,
  PermissionCommandPort,
} from '@application/commands/ports/permission-command.port';
import { ADMIN_QUERY_PORT, AdminQueryPort } from '@application/queries/ports';
import {
  CreatePermissionDto,
  UpdatePermissionDto,
  PermissionResponse,
  PaginationQuery,
  PaginatedResult,
} from '@presentation/dto';
import { TenantContext } from '@application/dto';
import { Tenant } from '../../http/tenant.decorator';

@Controller('admin/permissions')
export class AdminPermissionController {
  constructor(
    @Inject(PERMISSION_COMMAND_PORT) private readonly commandPort: PermissionCommandPort,
    @Inject(ADMIN_QUERY_PORT) private readonly queryPort: AdminQueryPort,
  ) {}

  @Get()
  list(
    @Tenant() tenant: TenantContext,
    @Query() query: PaginationQuery,
  ): Promise<PaginatedResult<PermissionResponse>> {
    return this.queryPort.getPermissions(tenant.id, query);
  }

  @Get(':id')
  get(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<PermissionResponse> {
    return this.queryPort.getPermission(tenant.id, id);
  }

  @Post()
  create(
    @Tenant() tenant: TenantContext,
    @Body() dto: CreatePermissionDto,
  ): Promise<{ id: string }> {
    return this.commandPort.createPermission(tenant.id, dto);
  }

  @Put(':id')
  update(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdatePermissionDto,
  ): Promise<void> {
    return this.commandPort.updatePermission(tenant.id, id, dto);
  }

  @Delete(':id')
  delete(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<void> {
    return this.commandPort.deletePermission(tenant.id, id);
  }
}
