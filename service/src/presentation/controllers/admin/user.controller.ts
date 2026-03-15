import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { UserCommandPort } from '@application/commands/ports/user-command.port';
import { AdminQueryPort } from '@application/queries/ports';
import {
  CreateUserDto,
  UpdateUserDto,
  UserResponse,
  RoleResponse,
  PaginationQuery,
  PaginatedResult,
} from '@presentation/dto';
import { TenantContext } from '@application/dto';
import { Tenant } from '../../http/tenant.decorator';

@Controller('admin/users')
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

  @Post()
  create(
    @Tenant() tenant: TenantContext,
    @Body() dto: CreateUserDto,
  ): Promise<{ id: string }> {
    return this.commandPort.createUser(tenant.id, dto);
  }

  @Put(':id')
  update(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<void> {
    return this.commandPort.updateUser(tenant.id, id, dto);
  }

  @Delete(':id')
  delete(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<void> {
    return this.commandPort.deleteUser(tenant.id, id);
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
  ): Promise<void> {
    return this.commandPort.assignRole(tenant.id, id, roleId);
  }

  @Delete(':id/roles/:roleId')
  removeRole(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('roleId') roleId: string,
  ): Promise<void> {
    return this.commandPort.removeRole(tenant.id, id, roleId);
  }
}
