import {
  Controller,
  Post,
  Put,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthCommandPort } from '@application/commands/ports/auth-command.port';
import { AuthQueryPort } from '@application/queries/ports';
import {
  SignupDto,
  WithdrawDto,
  ChangePasswordDto,
  PasswordResetRequestDto,
  PasswordResetDto,
  VerificationTokenDto,
  TotpConfirmationDto,
  UpdateProfileDto,
  ProfileResponse,
  ConsentResponse,
} from '@presentation/dto';
import { TenantContext } from '@application/dto';
import { Tenant } from '../http/tenant.decorator';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AccessGuard } from '@presentation/http/access.guard';
import { AuthenticatedUser } from '@application/ports/access-verifier.port';
import { AuthUser } from '@presentation/http/auth-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly commandPort: AuthCommandPort,
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

  @Post('email/verification-request')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  requestEmailVerification(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.commandPort.requestEmailVerification(tenant.id, user.userId);
  }

  @Post('email/verify')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  verifyEmail(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
    @Body() dto: VerificationTokenDto,
  ): Promise<void> {
    return this.commandPort.verifyEmail(tenant.id, user.userId, dto);
  }

  @Post('phone/verification-request')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  requestPhoneVerification(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.commandPort.requestPhoneVerification(tenant.id, user.userId);
  }

  @Post('phone/verify')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  verifyPhone(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
    @Body() dto: VerificationTokenDto,
  ): Promise<void> {
    return this.commandPort.verifyPhone(tenant.id, user.userId, dto);
  }

  @Post('mfa/totp/enroll')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  beginTotpEnrollment(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
  ): Promise<{ secret: string; otpauthUrl: string }> {
    return this.commandPort.beginTotpEnrollment(tenant.id, user.userId);
  }

  @Post('mfa/totp/confirm')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  confirmTotpEnrollment(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
    @Body() dto: TotpConfirmationDto,
  ): Promise<{ recoveryCodes: string[] }> {
    return this.commandPort.confirmTotpEnrollment(tenant.id, user.userId, dto);
  }

  @Delete('mfa/totp')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  disableTotp(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.commandPort.disableTotp(tenant.id, user.userId);
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
