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
  ADMIN_COMMAND_PORT,
  AdminCommandPort,
} from '@application/commands/ports/admin-command.port';
import { ADMIN_QUERY_PORT, AdminQueryPort } from '@application/queries/ports';
import {
  CreateUserDto,
  UpdateUserDto,
  UserResponse,
  PaginationQuery,
  PaginatedResult,
  TenantContext,
} from '@application/dto';
import { Tenant } from '../../http/tenant.decorator';

@Controller('admin/users')
export class AdminUserController {
  constructor(
    @Inject(ADMIN_COMMAND_PORT) private readonly commandPort: AdminCommandPort,
    @Inject(ADMIN_QUERY_PORT) private readonly queryPort: AdminQueryPort,
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
}
