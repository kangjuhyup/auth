import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ScopeCommandPort } from '@application/commands/ports/scope-command.port';
import { AdminQueryPort } from '@application/queries/ports';
import {
  AuditContext,
  TenantContext,
  CreateScopeDto as AppCreateScopeDto,
  PaginationQuery as AppPaginationQuery,
  UpdateScopeDto as AppUpdateScopeDto,
} from '@application/dto';
import {
  CreateScopeDto,
  PaginatedResult,
  PaginationQuery,
  ScopeResponse,
  UpdateScopeDto,
} from '@presentation/dto';
import { Tenant } from '@presentation/http/tenant.decorator';
import { AdminAuditContext } from '@presentation/http/admin-audit-context.decorator';
import { AdminGuard } from '@presentation/http/admin.guard';
import {
  ApiAdminResource,
  ApiCreatedIdSchema,
  ApiNoContentSchema,
  ApiOkSchema,
  ApiPaginatedSchema,
  OpenApiResponseSchemas,
} from '@presentation/openapi-response';

@UseGuards(AdminGuard)
@ApiAdminResource('Admin Scopes')
@Controller('t/:tenantCode/admin/scopes')
export class AdminScopeController {
  constructor(
    private readonly commandPort: ScopeCommandPort,
    private readonly queryPort: AdminQueryPort,
  ) {}

  @Get()
  @ApiPaginatedSchema('List scopes', OpenApiResponseSchemas.scope)
  list(
    @Tenant() tenant: TenantContext,
    @Query() query: PaginationQuery,
  ): Promise<PaginatedResult<ScopeResponse>> {
    return this.queryPort.getScopes(tenant.id, AppPaginationQuery.of(query));
  }

  @Get(':id')
  @ApiOkSchema('Get scope', OpenApiResponseSchemas.scope)
  get(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<ScopeResponse> {
    return this.queryPort.getScope(tenant.id, id);
  }

  @Post()
  @ApiCreatedIdSchema('Create scope')
  create(
    @Tenant() tenant: TenantContext,
    @Body() dto: CreateScopeDto,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<{ id: string }> {
    return this.commandPort.createScope(
      tenant.id,
      AppCreateScopeDto.of(dto),
      auditContext,
    );
  }

  @Put(':id')
  @ApiNoContentSchema('Update scope')
  update(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateScopeDto,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    return this.commandPort.updateScope(
      tenant.id,
      id,
      AppUpdateScopeDto.of(dto),
      auditContext,
    );
  }

  @Delete(':id')
  @ApiNoContentSchema('Delete scope')
  delete(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    return this.commandPort.deleteScope(tenant.id, id, auditContext);
  }
}
