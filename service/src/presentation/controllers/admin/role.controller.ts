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
import { AuditContext, TenantContext } from '@application/dto';
import { Tenant } from '../../http/tenant.decorator';
import { AdminAuditContext } from '@presentation/http/admin-audit-context.decorator';

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
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<{ id: string }> {
    if (!auditContext) return this.commandPort.createRole(tenant.id, dto);
    return this.commandPort.createRole(tenant.id, dto, auditContext);
  }

  @Put(':id')
  update(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    if (!auditContext) return this.commandPort.updateRole(tenant.id, id, dto);
    return this.commandPort.updateRole(tenant.id, id, dto, auditContext);
  }

  @Delete(':id')
  delete(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    if (!auditContext) return this.commandPort.deleteRole(tenant.id, id);
    return this.commandPort.deleteRole(tenant.id, id, auditContext);
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
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    if (!auditContext) {
      return this.commandPort.addPermissionToRole(tenant.id, id, permissionId);
    }
    return this.commandPort.addPermissionToRole(
      tenant.id,
      id,
      permissionId,
      auditContext,
    );
  }

  @Delete(':id/permissions/:permissionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePermission(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('permissionId') permissionId: string,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    if (!auditContext) {
      return this.commandPort.removePermissionFromRole(
        tenant.id,
        id,
        permissionId,
      );
    }
    return this.commandPort.removePermissionFromRole(
      tenant.id,
      id,
      permissionId,
      auditContext,
    );
  }
}
