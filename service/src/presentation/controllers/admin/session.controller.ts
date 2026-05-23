import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
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
  clearAdminSessionCookie,
  resolveAdminSessionToken,
  setAdminSessionCookie,
} from '@presentation/http/admin-session-cookie';

interface AdminLoginDto {
  username: string;
  password: string;
}

@Controller('admin/session')
export class AdminSessionController {
  constructor(
    private readonly adminSession: AdminSessionPort,
    private readonly config: ConfigService,
  ) {}

  @Post()
  async login(
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ username: string }> {
    const result = await this.adminSession.issueAdminToken(dto);
    if (!result) {
      throw new UnauthorizedException('Invalid credentials');
    }

    setAdminSessionCookie(response, this.config, result.token);

    return { username: result.username };
  }

  @Get()
  @UseGuards(AdminGuard)
  async current(@Req() request: Request): Promise<{ username: string }> {
    const token = resolveAdminSessionToken(request);
    if (!token) {
      throw new UnauthorizedException('Invalid session');
    }

    const session = await this.adminSession.getAdminSession(token);
    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }

    return session;
  }

  @Delete()
  @UseGuards(AdminGuard)
  @HttpCode(204)
  async logout(@Res({ passthrough: true }) response: Response): Promise<void> {
    clearAdminSessionCookie(response, this.config);
  }
}
