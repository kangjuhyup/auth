import {
  Controller,
  Post,
  Put,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
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
  UpdateMfaPreferenceDto,
  UpdateProfileDto,
  StartIdentityLinkDto,
  IdentityLinkCallbackQuery,
  ProfileResponse,
  ConsentResponse,
  RecoveryCodeStatusResponse,
} from '@presentation/dto';
import { TenantContext } from '@application/dto';
import { Tenant } from '../http/tenant.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessGuard } from '@presentation/http/access.guard';
import { AuthenticatedUser } from '@application/ports/access-verifier.port';
import { AuthUser } from '@presentation/http/auth-user.decorator';
import {
  ApiNoContentSchema,
  ApiOkArraySchema,
  ApiOkSchema,
  ApiRedirectSchema,
  OpenApiResponseSchemas,
} from '@presentation/openapi-response';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly commandPort: AuthCommandPort,
    private readonly queryPort: AuthQueryPort,
  ) {}

  @Post('signup')
  @ApiOkSchema('Sign up user', OpenApiResponseSchemas.signup)
  signup(
    @Tenant() tenant: TenantContext,
    @Body() dto: SignupDto,
  ): Promise<{ userId: string }> {
    return this.commandPort.signup(tenant.id, dto);
  }

  @Post('withdraw')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  @ApiNoContentSchema('Withdraw current user')
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
  @ApiNoContentSchema('Change current user password')
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
  @ApiNoContentSchema('Request password reset')
  requestPasswordReset(
    @Tenant() tenant: TenantContext,
    @Body() dto: PasswordResetRequestDto,
  ): Promise<void> {
    return this.commandPort.requestPasswordReset(tenant.id, dto);
  }

  @Post('password/reset')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  @ApiNoContentSchema('Reset password')
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
  @ApiNoContentSchema('Request email verification')
  requestEmailVerification(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.commandPort.requestEmailVerification(tenant.id, user.userId);
  }

  @Post('email/verify')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  @ApiNoContentSchema('Verify email')
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
  @ApiNoContentSchema('Request phone verification')
  requestPhoneVerification(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.commandPort.requestPhoneVerification(tenant.id, user.userId);
  }

  @Post('phone/verify')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  @ApiNoContentSchema('Verify phone')
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
  @ApiOkSchema('Begin TOTP enrollment', OpenApiResponseSchemas.totpEnrollment)
  beginTotpEnrollment(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
  ): Promise<{ secret: string; otpauthUrl: string }> {
    return this.commandPort.beginTotpEnrollment(tenant.id, user.userId);
  }

  @Post('mfa/totp/confirm')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOkSchema('Confirm TOTP enrollment', OpenApiResponseSchemas.recoveryCodes)
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
  @ApiNoContentSchema('Disable TOTP')
  disableTotp(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.commandPort.disableTotp(tenant.id, user.userId);
  }

  @Get('mfa/recovery-codes/status')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOkSchema(
    'Get recovery code status',
    OpenApiResponseSchemas.recoveryCodeStatus,
  )
  getRecoveryCodeStatus(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
  ): Promise<RecoveryCodeStatusResponse> {
    return this.queryPort.getRecoveryCodeStatus(tenant.id, user.userId);
  }

  @Post('mfa/recovery-codes/rotate')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOkSchema('Rotate recovery codes', OpenApiResponseSchemas.recoveryCodes)
  rotateRecoveryCodes(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
  ): Promise<{ recoveryCodes: string[] }> {
    return this.commandPort.rotateRecoveryCodes(tenant.id, user.userId);
  }

  @Put('mfa/preference')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  @ApiNoContentSchema('Update MFA preference')
  updateMfaPreference(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
    @Body() dto: UpdateMfaPreferenceDto,
  ): Promise<void> {
    return this.commandPort.updateMfaPreference(tenant.id, user.userId, dto);
  }

  @Get('profile')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOkSchema('Get current user profile', OpenApiResponseSchemas.user)
  getProfile(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
  ): Promise<ProfileResponse> {
    return this.queryPort.getProfile(tenant.id, user.userId);
  }

  @Put('profile')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  @ApiNoContentSchema('Update current user profile')
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
  @ApiOkArraySchema('List current user consents', OpenApiResponseSchemas.consent)
  getConsents(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
  ): Promise<ConsentResponse[]> {
    return this.queryPort.getConsents(tenant.id, user.userId);
  }

  @Get('identity-links')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOkArraySchema(
    'List current user identity links',
    OpenApiResponseSchemas.identityLink,
  )
  getIdentityLinks(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
  ): Promise<
    { id: string; provider: string; email?: string | null; linkedAt: Date }[]
  > {
    return this.queryPort.getIdentityLinks(tenant.id, user.userId);
  }

  @Post('identity-links/:provider/start')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOkSchema(
    'Start identity provider link',
    OpenApiResponseSchemas.authorizationUrl,
  )
  startIdentityLink(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
    @Param('provider') provider: string,
    @Body() dto: StartIdentityLinkDto,
    @Req() req: Request,
  ): Promise<{ authorizationUrl: string }> {
    const redirectUri = `${req.protocol}://${req.get('host')}/auth/identity-links/${provider}/callback?tenantCode=${encodeURIComponent(tenant.code)}`;
    return this.commandPort.startIdentityLink(tenant.id, user.userId, {
      provider,
      tenantCode: tenant.code,
      redirectUri,
      returnTo: dto.returnTo,
    });
  }

  @Get('identity-links/:provider/callback')
  @ApiRedirectSchema('Complete identity provider link')
  async completeIdentityLink(
    @Param('provider') provider: string,
    @Query() query: IdentityLinkCallbackQuery,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.commandPort.completeIdentityLink({
      provider,
      state: query.state,
      code: query.code,
      error: query.error,
    });
    res.redirect(result.redirectTo);
  }

  @Delete('identity-links/:identityId')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  @ApiNoContentSchema('Unlink identity provider')
  unlinkIdentity(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
    @Param('identityId') identityId: string,
  ): Promise<void> {
    return this.commandPort.unlinkIdentity(tenant.id, user.userId, identityId);
  }

  @Delete('consents/:clientId')
  @UseGuards(AccessGuard)
  @ApiBearerAuth('access-token')
  @ApiNoContentSchema('Revoke consent')
  revokeConsent(
    @Tenant() tenant: TenantContext,
    @AuthUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
  ): Promise<void> {
    return this.commandPort.revokeConsent(tenant.id, user.userId, clientId);
  }
}
