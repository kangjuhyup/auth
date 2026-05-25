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
import { AdminAuditContext } from '@presentation/http/admin-audit-context.decorator';
import {
  AuditContext,
  CreateTenantDto as AppCreateTenantDto,
  PaginationQuery as AppPaginationQuery,
  UpdateTenantDto as AppUpdateTenantDto,
} from '@application/dto';
import {
  ApiAdminResource,
  ApiCreatedIdSchema,
  ApiNoContentSchema,
  ApiOkSchema,
  ApiPaginatedSchema,
  OpenApiResponseSchemas,
} from '@presentation/openapi-response';

@UseGuards(AdminGuard)
@ApiAdminResource('Admin Tenants')
@Controller('admin/tenants')
export class AdminTenantController {
  constructor(
    private readonly commandPort: TenantCommandPort,
    private readonly queryPort: AdminQueryPort,
  ) {}

  @Get()
  @ApiPaginatedSchema('List tenants', OpenApiResponseSchemas.tenant)
  list(
    @Query() query: PaginationQuery,
  ): Promise<PaginatedResult<TenantResponse>> {
    return this.queryPort.getTenants(AppPaginationQuery.of(query));
  }

  @Get(':id')
  @ApiOkSchema('Get tenant', OpenApiResponseSchemas.tenant)
  get(@Param('id') id: string): Promise<TenantResponse> {
    return this.queryPort.getTenant(id);
  }

  @Post()
  @ApiCreatedIdSchema('Create tenant')
  create(
    @Body() dto: CreateTenantDto,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<{ id: string }> {
    const command = AppCreateTenantDto.of(dto);
    if (!auditContext) return this.commandPort.createTenant(command);
    return this.commandPort.createTenant(command, auditContext);
  }

  @Put(':id')
  @ApiNoContentSchema('Update tenant')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    const command = AppUpdateTenantDto.of(dto);
    if (!auditContext) return this.commandPort.updateTenant(id, command);
    return this.commandPort.updateTenant(id, command, auditContext);
  }

  @Delete(':id')
  @ApiNoContentSchema('Delete tenant')
  delete(
    @Param('id') id: string,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    if (!auditContext) return this.commandPort.deleteTenant(id);
    return this.commandPort.deleteTenant(id, auditContext);
  }
}
