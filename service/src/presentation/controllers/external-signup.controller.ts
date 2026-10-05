import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiOkSchema } from '@presentation/openapi-response';
import {
  Body,
  ConflictException,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ExternalSignupCommandPort,
  ExternalSignupError,
} from '@application/ports/external-signup.port';
import type { TenantContext } from '@application/dto';
import type { ServicePrincipal as Principal } from '@application/ports/service-access-verifier.port';
import { ExternalSignupBody } from '@presentation/dto/provisioning/external-signup.dto';
import { ServiceProvisioningGuard } from '@presentation/http/service-provisioning.guard';
import { ServicePrincipal } from '@presentation/http/service-principal.decorator';
import { Tenant } from '@presentation/http/tenant.decorator';
import { IdempotencyKey } from '@presentation/http/idempotency-key.decorator';
@ApiTags('External Signup Provisioning')
@ApiBearerAuth('access-token')
@Controller('t/:tenantCode/provisioning/external-signups')
@UseGuards(ServiceProvisioningGuard)
export class ExternalSignupController {
  constructor(private readonly commands: ExternalSignupCommandPort) {}
  @Post('claim')
  @ApiOkSchema('Claim browser-verified external identity', {
    type: 'object',
    required: [
      'ticketId',
      'provider',
      'providerSub',
      'clientId',
      'issuer',
      'expiresAt',
    ],
    properties: {
      ticketId: { type: 'string' },
      provider: { type: 'string' },
      providerSub: {
        type: 'string',
        description: 'Server-only provider identity; never expose to browser',
      },
      clientId: { type: 'string' },
      issuer: { type: 'string' },
      expiresAt: { type: 'string', format: 'date-time' },
    },
  })
  async claim(
    @Tenant() tenant: TenantContext,
    @ServicePrincipal() principal: Principal,
    @Body() body: ExternalSignupBody,
  ) {
    try {
      return await this.commands.claim(tenant.id, principal.clientId, body);
    } catch (error) {
      if (error instanceof ExternalSignupError)
        throw new ConflictException(error.code);
      throw error;
    }
  }
  @Post('complete')
  @ApiOkSchema('Complete passwordless provisioning', {
    type: 'object',
    required: ['issuer', 'subject'],
    properties: { issuer: { type: 'string' }, subject: { type: 'string' } },
  })
  async complete(
    @Tenant() tenant: TenantContext,
    @ServicePrincipal() principal: Principal,
    @Body() body: ExternalSignupBody,
    @IdempotencyKey() key: string,
  ) {
    try {
      return await this.commands.complete(
        tenant.id,
        principal.clientId,
        body,
        key,
      );
    } catch (error) {
      if (error instanceof ExternalSignupError)
        throw new ConflictException(error.code);
      throw error;
    }
  }
}
