import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AdminGuard } from '@presentation/http/admin.guard';
import { AdminSessionPort } from '@application/ports/admin-session.port';
import {
  clearAdminSessionCookies,
  resolveAdminRefreshToken,
  resolveAdminSessionToken,
  setAdminRefreshCookie,
  setAdminSessionCookie,
} from '@presentation/http/admin-session-cookie';
import { AdminLoginDto, ChangePasswordDto } from '@presentation/dto';
import {
  ApiAdminResource,
  ApiNoContentSchema,
  ApiOkSchema,
  OpenApiResponseSchemas,
} from '@presentation/openapi-response';

function pickFirst(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }

  return typeof value === 'string' ? value : undefined;
}

@ApiAdminResource('Admin Session')
@Controller('admin/session')
export class AdminSessionController {
  constructor(
    private readonly adminSession: AdminSessionPort,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @ApiOkSchema(
    'Issue admin session cookie',
    OpenApiResponseSchemas.adminSession,
  )
  async login(
    @Body() dto: AdminLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ username: string; passwordChangeRequired: boolean }> {
    const result = await this.adminSession.issueAdminToken({
      ...dto,
      ipAddress: request.ip,
      userAgent: pickFirst(request.headers?.['user-agent']),
      correlationId:
        pickFirst(request.headers?.['x-correlation-id']) ??
        pickFirst(request.headers?.['x-request-id']),
    });
    if (!result) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if ('blocked' in result) {
      if (result.reason === 'rate_limited') {
        throw new HttpException(
          'Too many login attempts',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new HttpException('Account temporarily locked', HttpStatus.LOCKED);
    }

    setAdminSessionCookie(response, this.config, result.accessToken);
    setAdminRefreshCookie(response, this.config, result.refreshToken);

    return {
      username: result.username,
      passwordChangeRequired: result.passwordChangeRequired,
    };
  }

  @Post('refresh')
  @ApiOkSchema(
    'Refresh admin session cookies',
    OpenApiResponseSchemas.adminSession,
  )
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ username: string; passwordChangeRequired: boolean }> {
    const refreshToken = resolveAdminRefreshToken(request);
    if (!refreshToken) {
      throw new UnauthorizedException('Invalid session');
    }

    const session = await this.adminSession.refreshAdminSession(refreshToken);
    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }

    setAdminSessionCookie(response, this.config, session.accessToken);
    setAdminRefreshCookie(response, this.config, session.refreshToken);

    return {
      username: session.username,
      passwordChangeRequired: session.passwordChangeRequired,
    };
  }

  @Get()
  @UseGuards(AdminGuard)
  @ApiOkSchema('Get current admin session', OpenApiResponseSchemas.adminSession)
  async current(
    @Req() request: Request,
  ): Promise<{ username: string; passwordChangeRequired: boolean }> {
    const token = resolveAdminSessionToken(request);
    if (!token) {
      throw new UnauthorizedException('Invalid session');
    }

    const session = await this.adminSession.getAdminSession(token);
    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }

    return {
      username: session.username,
      passwordChangeRequired: session.passwordChangeRequired,
    };
  }

  @Put('password')
  @UseGuards(AdminGuard)
  @HttpCode(204)
  @ApiNoContentSchema('Change admin password')
  async changePassword(
    @Req() request: Request,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    const token = resolveAdminSessionToken(request);
    if (!token) {
      throw new UnauthorizedException('Invalid session');
    }

    await this.adminSession.changePassword(token, dto);
  }

  @Delete()
  @HttpCode(204)
  @ApiNoContentSchema('Clear admin session')
  async logout(@Res({ passthrough: true }) response: Response): Promise<void> {
    clearAdminSessionCookies(response, this.config);
  }
}
