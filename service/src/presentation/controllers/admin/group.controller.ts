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
import { GroupCommandPort } from '@application/commands/ports/group-command.port';
import { AdminQueryPort } from '@application/queries/ports';
import {
  CreateGroupDto,
  UpdateGroupDto,
  GroupResponse,
  RoleResponse,
  PaginationQuery,
  PaginatedResult,
} from '@presentation/dto';
import { AuditContext, TenantContext } from '@application/dto';
import { Tenant } from '../../http/tenant.decorator';
import { AdminAuditContext } from '@presentation/http/admin-audit-context.decorator';
import {
  ApiAdminResource,
  ApiCreatedIdSchema,
  ApiNoContentSchema,
  ApiOkArraySchema,
  ApiOkSchema,
  ApiPaginatedSchema,
  OpenApiResponseSchemas,
} from '@presentation/openapi-response';

@UseGuards(AdminGuard)
@ApiAdminResource('Admin Groups')
@Controller('t/:tenantCode/admin/groups')
export class AdminGroupController {
  constructor(
    private readonly commandPort: GroupCommandPort,
    private readonly queryPort: AdminQueryPort,
  ) {}

  @Get()
  @ApiPaginatedSchema('List groups', OpenApiResponseSchemas.group)
  list(
    @Tenant() tenant: TenantContext,
    @Query() query: PaginationQuery,
  ): Promise<PaginatedResult<GroupResponse>> {
    return this.queryPort.getGroups(tenant.id, query);
  }

  @Get(':id')
  @ApiOkSchema('Get group', OpenApiResponseSchemas.group)
  get(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<GroupResponse> {
    return this.queryPort.getGroup(tenant.id, id);
  }

  @Post()
  @ApiCreatedIdSchema('Create group')
  create(
    @Tenant() tenant: TenantContext,
    @Body() dto: CreateGroupDto,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<{ id: string }> {
    if (!auditContext) return this.commandPort.createGroup(tenant.id, dto);
    return this.commandPort.createGroup(tenant.id, dto, auditContext);
  }

  @Put(':id')
  @ApiNoContentSchema('Update group')
  update(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    if (!auditContext) return this.commandPort.updateGroup(tenant.id, id, dto);
    return this.commandPort.updateGroup(tenant.id, id, dto, auditContext);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentSchema('Delete group')
  delete(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    if (!auditContext) return this.commandPort.deleteGroup(tenant.id, id);
    return this.commandPort.deleteGroup(tenant.id, id, auditContext);
  }

  @Get(':id/roles')
  @ApiOkArraySchema('List group roles', OpenApiResponseSchemas.role)
  getRoles(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<RoleResponse[]> {
    return this.queryPort.getGroupRoles(tenant.id, id);
  }

  @Post(':id/roles/:roleId')
  @ApiNoContentSchema('Assign role to group')
  assignRole(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('roleId') roleId: string,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    if (!auditContext) {
      return this.commandPort.assignRole(tenant.id, id, roleId);
    }
    return this.commandPort.assignRole(tenant.id, id, roleId, auditContext);
  }

  @Delete(':id/roles/:roleId')
  @ApiNoContentSchema('Remove role from group')
  removeRole(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('roleId') roleId: string,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    if (!auditContext) {
      return this.commandPort.removeRole(tenant.id, id, roleId);
    }
    return this.commandPort.removeRole(tenant.id, id, roleId, auditContext);
  }
}
