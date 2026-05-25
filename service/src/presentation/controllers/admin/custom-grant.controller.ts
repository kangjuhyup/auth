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
import { CustomGrantCommandPort } from '@application/commands/ports/custom-grant-command.port';
import { AdminQueryPort } from '@application/queries/ports';
import {
  AuditContext,
  TenantContext,
  CreateCustomGrantDto as AppCreateCustomGrantDto,
  PaginationQuery as AppPaginationQuery,
  UpdateCustomGrantDto as AppUpdateCustomGrantDto,
} from '@application/dto';
import {
  CreateCustomGrantDto,
  CustomGrantResponse,
  PaginatedResult,
  PaginationQuery,
  UpdateCustomGrantDto,
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
@ApiAdminResource('Admin Custom Grants')
@Controller('t/:tenantCode/admin/custom-grants')
export class AdminCustomGrantController {
  constructor(
    private readonly commandPort: CustomGrantCommandPort,
    private readonly queryPort: AdminQueryPort,
  ) {}

  @Get()
  @ApiPaginatedSchema('List custom grants', OpenApiResponseSchemas.customGrant)
  list(
    @Tenant() tenant: TenantContext,
    @Query() query: PaginationQuery,
  ): Promise<PaginatedResult<CustomGrantResponse>> {
    return this.queryPort.getCustomGrants(
      tenant.id,
      AppPaginationQuery.of(query),
    );
  }

  @Get(':id')
  @ApiOkSchema('Get custom grant', OpenApiResponseSchemas.customGrant)
  get(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<CustomGrantResponse> {
    return this.queryPort.getCustomGrant(tenant.id, id);
  }

  @Post()
  @ApiCreatedIdSchema('Create custom grant')
  create(
    @Tenant() tenant: TenantContext,
    @Body() dto: CreateCustomGrantDto,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<{ id: string }> {
    return this.commandPort.createCustomGrant(
      tenant.id,
      AppCreateCustomGrantDto.of(dto),
      auditContext,
    );
  }

  @Put(':id')
  @ApiNoContentSchema('Update custom grant')
  update(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateCustomGrantDto,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    return this.commandPort.updateCustomGrant(
      tenant.id,
      id,
      AppUpdateCustomGrantDto.of(dto),
      auditContext,
    );
  }

  @Delete(':id')
  @ApiNoContentSchema('Delete custom grant')
  delete(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @AdminAuditContext() auditContext?: AuditContext,
  ): Promise<void> {
    return this.commandPort.deleteCustomGrant(tenant.id, id, auditContext);
  }
}
