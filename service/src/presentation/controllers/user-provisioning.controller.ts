import {
  Body,
  ConflictException,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ProvisionUserCommand } from '@application/commands/commands/provision-user.command';
import {
  UserProvisioningCommandPort,
  UserProvisioningError,
} from '@application/commands/ports/user-provisioning-command.port';
import type { AuditContext, TenantContext } from '@application/dto';
import type { ServicePrincipal as ServicePrincipalValue } from '@application/ports/service-access-verifier.port';
import {
  ProvisionUserBody,
  ProvisionUserResponse,
} from '@presentation/dto/provisioning/user-provisioning.dto';
import { IdempotencyKey } from '@presentation/http/idempotency-key.decorator';
import { ProvisioningAuditContext } from '@presentation/http/provisioning-audit-context.decorator';
import { ServicePrincipal } from '@presentation/http/service-principal.decorator';
import { ServiceProvisioningGuard } from '@presentation/http/service-provisioning.guard';
import { Tenant } from '@presentation/http/tenant.decorator';

@ApiTags('Service User Provisioning')
@ApiBearerAuth('access-token')
@UseGuards(ServiceProvisioningGuard)
@Controller('t/:tenantCode/provisioning/users')
export class UserProvisioningController {
  constructor(private readonly commands: UserProvisioningCommandPort) {}

  @Post()
  @ApiOperation({ summary: 'Provision an Auth user for this tenant' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      '16-128 characters: letters, digits, dot, underscore, tilde, hyphen',
  })
  @ApiCreatedResponse({ type: ProvisionUserResponse })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired, or cross-tenant token',
  })
  @ApiForbiddenResponse({
    description: 'The service token lacks auth.user.provision',
  })
  @ApiConflictResponse({
    description: 'Username or idempotency binding conflict',
  })
  async provision(
    @Tenant() tenant: TenantContext,
    @ServicePrincipal() principal: ServicePrincipalValue,
    @IdempotencyKey() idempotencyKey: string,
    @Body() body: ProvisionUserBody,
    @ProvisioningAuditContext() auditContext: AuditContext,
  ): Promise<ProvisionUserResponse> {
    try {
      return await this.commands.provision(
        tenant.id,
        principal.clientId,
        ProvisionUserCommand.of({ ...body, idempotencyKey }),
        auditContext,
      );
    } catch (error) {
      if (error instanceof UserProvisioningError) {
        throw new ConflictException(error.code);
      }
      throw error;
    }
  }
}
