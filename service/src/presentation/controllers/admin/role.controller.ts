import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '@presentation/http/admin.guard';
import { RoleCommandPort } from '@application/commands/ports/role-command.port';
import { AdminQueryPort } from '@application/queries/ports';
import {
  CreateRoleDto,
  UpdateRoleDto,
  RoleResponse,
  PermissionResponse,
  PaginationQuery,
  PaginatedResult,
} from '@presentation/dto';
import { TenantContext } from '@application/dto';
import { Tenant } from '../../http/tenant.decorator';

@UseGuards(AdminGuard)
@Controller('t/:tenantCode/admin/roles')
export class AdminRoleController {
  constructor(
    private readonly commandPort: RoleCommandPort,
    private readonly queryPort: AdminQueryPort,
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

  // ── Role-Permission ───────────────────────────────────────────────────────

  @Get(':id/permissions')
  listPermissions(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Query() query: PaginationQuery,
  ): Promise<PaginatedResult<PermissionResponse>> {
    return this.queryPort.getRolePermissions(tenant.id, id, query);
  }

  @Post(':id/permissions')
  @HttpCode(HttpStatus.NO_CONTENT)
  addPermission(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body('permissionId') permissionId: string,
  ): Promise<void> {
    return this.commandPort.addPermissionToRole(tenant.id, id, permissionId);
  }

  @Delete(':id/permissions/:permissionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePermission(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('permissionId') permissionId: string,
  ): Promise<void> {
    return this.commandPort.removePermissionFromRole(tenant.id, id, permissionId);
  }
}
