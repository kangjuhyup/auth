import {
  Controller,
  Post,
  Put,
  Get,
  Delete,
  Body,
  Param,
  Inject,
  UseGuards,
} from '@nestjs/common';
import {
  AUTH_COMMAND_PORT,
  AuthCommandPort,
} from '@application/commands/ports/auth-command.port';
import { AUTH_QUERY_PORT, AuthQueryPort } from '@application/queries/ports';
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
import { ApiBearerAuth } from '@nestjs/swagger';
import { AccessGuard } from '@presentation/http/access.guard';
import { AuthenticatedUser } from '@application/ports/access-verifier.port';
import { AuthUser } from '@presentation/http/auth-user.decorator';

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
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  withdraw(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
    @Body() dto: WithdrawDto,
  ): Promise<void> {
    return this.commandPort.withdraw(tenant.id, user.userId, dto);
  }

  @Put('password')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  changePassword(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.commandPort.changePassword(tenant.id, user.userId, dto);
  }

  @Post('password/reset-request')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  requestPasswordReset(
    @Tenant() tenant: TenantContext,
    @Body() dto: PasswordResetRequestDto,
  ): Promise<void> {
    return this.commandPort.requestPasswordReset(tenant.id, dto);
  }

  @Post('password/reset')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  resetPassword(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
    @Body() dto: PasswordResetDto,
  ): Promise<void> {
    return this.commandPort.resetPassword(tenant.id, user.userId, dto);
  }

  @Get('profile')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  getProfile(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
  ): Promise<ProfileResponse> {
    return this.queryPort.getProfile(tenant.id, user.userId);
  }

  @Put('profile')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  updateProfile(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<void> {
    return this.commandPort.updateProfile(tenant.id, user.userId, dto);
  }

  @Get('consents')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  getConsents(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
  ): Promise<ConsentResponse[]> {
    return this.queryPort.getConsents(tenant.id, user.userId);
  }

  @Delete('consents/:clientId')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  revokeConsent(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
  ): Promise<void> {
    return this.commandPort.revokeConsent(tenant.id, user.userId, clientId);
  }
}
