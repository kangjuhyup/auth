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
  UserConsentResponse,
  RoleResponse,
  PaginationQuery,
  PaginatedResult,
} from '@presentation/dto';
import { AuditContext, TenantContext } from '@application/dto';
import { Tenant } from '../../http/tenant.decorator';
import { AdminAuditContext } from '@presentation/http/admin-audit-context.decorator';

@UseGuards(AdminGuard)
@Controller('t/:tenantCode/admin/users')
export class AdminUserController {
  constructor(
    private readonly commandPort: UserCommandPort,
    private readonly queryPort: AdminQueryPort,
  ) {}

  @Get()
  list(
    @Tenant() tenant: TenantContext,
    @Query() query: PaginationQuery,
  ): Promise<PaginatedResult<UserResponse>> {
    return this.queryPort.getUsers(tenant.id, query);
  }

  @Get(':id')
  get(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<UserResponse> {
    return this.queryPort.getUser(tenant.id, id);
  }

  @Get(':id/consents')
  getConsents(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Query() query: PaginationQuery,
  ): Promise<PaginatedResult<UserConsentResponse>> {
    return this.queryPort.getUserConsents(tenant.id, id, query);
  }

  @Get(':id/consents/history')
  getConsentHistory(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Query() query: PaginationQuery,
  ): Promise<PaginatedResult<UserConsentResponse>> {
    return this.queryPort.getUserConsentHistory(tenant.id, id, query);
  }

  @Post()
  create(
    @Tenant() tenant: TenantContext,
    @Body() dto: CreateUserDto,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<{ id: string }> {
    if (!auditContext) return this.commandPort.createUser(tenant.id, dto);
    return this.commandPort.createUser(tenant.id, dto, auditContext);
  }

  @Put(':id')
  update(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    if (!auditContext) return this.commandPort.updateUser(tenant.id, id, dto);
    return this.commandPort.updateUser(tenant.id, id, dto, auditContext);
  }

  @Delete(':id')
  delete(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    if (!auditContext) return this.commandPort.deleteUser(tenant.id, id);
    return this.commandPort.deleteUser(tenant.id, id, auditContext);
  }

  @Get(':id/roles')
  getRoles(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<RoleResponse[]> {
    return this.queryPort.getUserRoles(tenant.id, id);
  }

  @Post(':id/roles/:roleId')
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
