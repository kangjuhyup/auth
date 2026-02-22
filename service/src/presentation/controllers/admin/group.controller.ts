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
  GROUP_COMMAND_PORT,
  GroupCommandPort,
} from '@application/commands/ports/group-command.port';
import { ADMIN_QUERY_PORT, AdminQueryPort } from '@application/queries/ports';
import {
  CreateGroupDto,
  UpdateGroupDto,
  GroupResponse,
  PaginationQuery,
  PaginatedResult,
} from '@presentation/dto';
import { TenantContext } from '@application/dto';
import { Tenant } from '../../http/tenant.decorator';

@Controller('admin/groups')
export class AdminGroupController {
  constructor(
    @Inject(GROUP_COMMAND_PORT) private readonly commandPort: GroupCommandPort,
    @Inject(ADMIN_QUERY_PORT) private readonly queryPort: AdminQueryPort,
  ) {}

  @Get()
  list(
    @Tenant() tenant: TenantContext,
    @Query() query: PaginationQuery,
  ): Promise<PaginatedResult<GroupResponse>> {
    return this.queryPort.getGroups(tenant.id, query);
  }

  @Get(':id')
  get(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<GroupResponse> {
    return this.queryPort.getGroup(tenant.id, id);
  }

  @Post()
  create(
    @Tenant() tenant: TenantContext,
    @Body() dto: CreateGroupDto,
  ): Promise<{ id: string }> {
    return this.commandPort.createGroup(tenant.id, dto);
  }

  @Put(':id')
  update(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
  ): Promise<void> {
    return this.commandPort.updateGroup(tenant.id, id, dto);
  }

  @Delete(':id')
  delete(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<void> {
    return this.commandPort.deleteGroup(tenant.id, id);
  }
}
