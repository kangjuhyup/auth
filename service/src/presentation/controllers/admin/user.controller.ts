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
import { UserCommandPort } from '@application/commands/ports/user-command.port';
import { AdminQueryPort } from '@application/queries/ports';
import {
  CreateUserDto,
  UpdateUserDto,
  UserResponse,
  UserSessionResponse,
  UserConsentResponse,
  UserListQuery,
  PaginationQuery,
  RoleResponse,
  PaginatedResult,
} from '@presentation/dto';
import {
  AuditContext,
  TenantContext,
  CreateUserDto as AppCreateUserDto,
  UpdateUserDto as AppUpdateUserDto,
  UserListQuery as AppUserListQuery,
  PaginationQuery as AppPaginationQuery,
} from '@application/dto';
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
@ApiAdminResource('Admin Users')
@Controller('t/:tenantCode/admin/users')
export class AdminUserController {
  constructor(
    private readonly commandPort: UserCommandPort,
    private readonly queryPort: AdminQueryPort,
  ) {}

  @Get()
  @ApiPaginatedSchema('List users', OpenApiResponseSchemas.user)
  list(
    @Tenant() tenant: TenantContext,
    @Query() query: UserListQuery,
  ): Promise<PaginatedResult<UserResponse>> {
    return this.queryPort.getUsers(tenant.id, AppUserListQuery.of(query));
  }

  @Get(':id')
  @ApiOkSchema('Get user', OpenApiResponseSchemas.user)
  get(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<UserResponse> {
    return this.queryPort.getUser(tenant.id, id);
  }

  @Get(':id/consents')
  @ApiPaginatedSchema('List user consents', OpenApiResponseSchemas.userConsent)
  getConsents(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Query() query: PaginationQuery,
  ): Promise<PaginatedResult<UserConsentResponse>> {
    return this.queryPort.getUserConsents(
      tenant.id,
      id,
      AppPaginationQuery.of(query),
    );
  }

  @Get(':id/consents/history')
  @ApiPaginatedSchema(
    'List user consent history',
    OpenApiResponseSchemas.userConsent,
  )
  getConsentHistory(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Query() query: PaginationQuery,
  ): Promise<PaginatedResult<UserConsentResponse>> {
    return this.queryPort.getUserConsentHistory(
      tenant.id,
      id,
      AppPaginationQuery.of(query),
    );
  }

  @Get(':id/sessions')
  @ApiOkArraySchema('List user sessions', OpenApiResponseSchemas.userSession)
  getSessions(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<UserSessionResponse[]> {
    return this.queryPort.getUserSessions(tenant.id, id);
  }

  @Delete(':id/sessions/:sessionId')
  @ApiNoContentSchema('Revoke user session')
  revokeSession(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    if (!auditContext) {
      return this.commandPort.revokeUserSession(tenant.id, id, sessionId);
    }
    return this.commandPort.revokeUserSession(
      tenant.id,
      id,
      sessionId,
      auditContext,
    );
  }

  @Delete(':id/sessions')
  @ApiNoContentSchema('Revoke all user sessions')
  revokeSessions(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    if (!auditContext) {
      return this.commandPort.revokeUserSessions(tenant.id, id);
    }
    return this.commandPort.revokeUserSessions(tenant.id, id, auditContext);
  }

  @Post()
  @ApiCreatedIdSchema('Create user')
  create(
    @Tenant() tenant: TenantContext,
    @Body() dto: CreateUserDto,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<{ id: string }> {
    const command = AppCreateUserDto.of(dto);
    if (!auditContext) return this.commandPort.createUser(tenant.id, command);
    return this.commandPort.createUser(tenant.id, command, auditContext);
  }

  @Put(':id')
  @ApiNoContentSchema('Update user')
  update(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    const command = AppUpdateUserDto.of(dto);
    if (!auditContext) {
      return this.commandPort.updateUser(tenant.id, id, command);
    }
    return this.commandPort.updateUser(tenant.id, id, command, auditContext);
  }

  @Delete(':id')
  @ApiNoContentSchema('Delete user')
  delete(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    if (!auditContext) return this.commandPort.deleteUser(tenant.id, id);
    return this.commandPort.deleteUser(tenant.id, id, auditContext);
  }

  @Get(':id/roles')
  @ApiOkArraySchema('List user roles', OpenApiResponseSchemas.role)
  getRoles(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<RoleResponse[]> {
    return this.queryPort.getUserRoles(tenant.id, id);
  }

  @Post(':id/roles/:roleId')
  @ApiNoContentSchema('Assign role to user')
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
  @ApiNoContentSchema('Remove role from user')
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
