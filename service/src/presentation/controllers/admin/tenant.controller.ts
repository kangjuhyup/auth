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
import { TenantCommandPort } from '@application/commands/ports/tenant-command.port';
import { AdminQueryPort } from '@application/queries/ports';
import {
  CreateTenantDto,
  UpdateTenantDto,
  TenantResponse,
  PaginationQuery,
  PaginatedResult,
} from '@presentation/dto';

@UseGuards(AdminGuard)
@Controller('admin/tenants')
export class AdminTenantController {
  constructor(
    private readonly commandPort: TenantCommandPort,
    private readonly queryPort: AdminQueryPort,
  ) {}

  @Get()
  list(
    @Query() query: PaginationQuery,
  ): Promise<PaginatedResult<TenantResponse>> {
    return this.queryPort.getTenants(query);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<TenantResponse> {
    return this.queryPort.getTenant(id);
  }

  @Post()
  create(@Body() dto: CreateTenantDto): Promise<{ id: string }> {
    return this.commandPort.createTenant(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto): Promise<void> {
    return this.commandPort.updateTenant(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string): Promise<void> {
    return this.commandPort.deleteTenant(id);
  }
}
