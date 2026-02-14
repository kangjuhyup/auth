import {
  Controller,
  Post,
  Put,
  Get,
  Delete,
  Body,
  Param,
  Inject,
} from '@nestjs/common';
import {
  AUTH_COMMAND_PORT,
  AuthCommandPort,
} from '@application/command/commands/ports/auth-command.port';
import { AUTH_QUERY_PORT, AuthQueryPort } from '@application/query/ports';
import {
  SignupDto,
  WithdrawDto,
  ChangePasswordDto,
  PasswordResetRequestDto,
  PasswordResetDto,
  UpdateProfileDto,
  ProfileResponse,
  ConsentResponse,
  TenantContext,
} from '@application/dto';
import { Tenant } from '../http/tenant.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AUTH_COMMAND_PORT)
    private readonly commandPort: AuthCommandPort,
    @Inject(AUTH_QUERY_PORT)
    private readonly queryPort: AuthQueryPort,
  ) {}

  @Post('signup')
  signup(
    @Tenant() tenant: TenantContext,
    @Body() dto: SignupDto,
  ): Promise<{ userId: string }> {
    return this.commandPort.signup(tenant.id, dto);
  }

  @Post('withdraw')
  withdraw(
    @Tenant() tenant: TenantContext,
    @Body() dto: WithdrawDto,
  ): Promise<void> {
    // TODO: extract userId from authenticated user
    const userId = '';
    return this.commandPort.withdraw(tenant.id, userId, dto);
  }

  @Put('password')
  changePassword(
    @Tenant() tenant: TenantContext,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    const userId = '';
    return this.commandPort.changePassword(tenant.id, userId, dto);
  }

  @Post('password/reset-request')
  requestPasswordReset(
    @Tenant() tenant: TenantContext,
    @Body() dto: PasswordResetRequestDto,
  ): Promise<void> {
    return this.commandPort.requestPasswordReset(tenant.id, dto);
  }

  @Post('password/reset')
  resetPassword(
    @Tenant() tenant: TenantContext,
    @Body() dto: PasswordResetDto,
  ): Promise<void> {
    return this.commandPort.resetPassword(tenant.id, dto);
  }

  @Get('profile')
  getProfile(@Tenant() tenant: TenantContext): Promise<ProfileResponse> {
    const userId = '';
    return this.queryPort.getProfile(tenant.id, userId);
  }

  @Put('profile')
  updateProfile(
    @Tenant() tenant: TenantContext,
    @Body() dto: UpdateProfileDto,
  ): Promise<void> {
    const userId = '';
    return this.commandPort.updateProfile(tenant.id, userId, dto);
  }

  @Get('consents')
  getConsents(@Tenant() tenant: TenantContext): Promise<ConsentResponse[]> {
    const userId = '';
    return this.queryPort.getConsents(tenant.id, userId);
  }

  @Delete('consents/:clientId')
  revokeConsent(
    @Tenant() tenant: TenantContext,
    @Param('clientId') clientId: string,
  ): Promise<void> {
    const userId = '';
    return this.commandPort.revokeConsent(tenant.id, userId, clientId);
  }
}
