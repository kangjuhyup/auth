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
import { PermissionCommandPort } from '@application/commands/ports/permission-command.port';
import { AdminQueryPort } from '@application/queries/ports';
import {
  CreatePermissionDto,
  UpdatePermissionDto,
  PermissionResponse,
  PaginationQuery,
  PaginatedResult,
} from '@presentation/dto';
import {
  AuditContext,
  TenantContext,
  CreatePermissionDto as AppCreatePermissionDto,
  PaginationQuery as AppPaginationQuery,
  UpdatePermissionDto as AppUpdatePermissionDto,
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
@ApiAdminResource('Admin Permissions')
@Controller('t/:tenantCode/admin/permissions')
export class AdminPermissionController {
  constructor(
    private readonly commandPort: PermissionCommandPort,
    private readonly queryPort: AdminQueryPort,
  ) {}

  @Get()
  @ApiPaginatedSchema('List permissions', OpenApiResponseSchemas.permission)
  list(
    @Tenant() tenant: TenantContext,
    @Query() query: PaginationQuery,
  ): Promise<PaginatedResult<PermissionResponse>> {
    return this.queryPort.getPermissions(
      tenant.id,
      AppPaginationQuery.of(query),
    );
  }

  @Get(':id')
  @ApiOkSchema('Get permission', OpenApiResponseSchemas.permission)
  get(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<PermissionResponse> {
    return this.queryPort.getPermission(tenant.id, id);
  }

  @Post()
  @ApiCreatedIdSchema('Create permission')
  create(
    @Tenant() tenant: TenantContext,
    @Body() dto: CreatePermissionDto,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<{ id: string }> {
    const command = AppCreatePermissionDto.of(dto);
    if (!auditContext) {
      return this.commandPort.createPermission(tenant.id, command);
    }
    return this.commandPort.createPermission(tenant.id, command, auditContext);
  }

  @Put(':id')
  @ApiNoContentSchema('Update permission')
  update(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdatePermissionDto,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    const command = AppUpdatePermissionDto.of(dto);
    if (!auditContext) {
      return this.commandPort.updatePermission(tenant.id, id, command);
    }
    return this.commandPort.updatePermission(
      tenant.id,
      id,
      command,
      auditContext,
    );
  }

  @Delete(':id')
  @ApiNoContentSchema('Delete permission')
  delete(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    if (!auditContext) return this.commandPort.deletePermission(tenant.id, id);
    return this.commandPort.deletePermission(tenant.id, id, auditContext);
  }
}
