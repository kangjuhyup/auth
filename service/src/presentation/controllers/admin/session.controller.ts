import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminGuard, signAdminToken } from '@presentation/http/admin.guard';

interface AdminLoginDto {
  username: string;
  password: string;
}

@Controller('admin/session')
export class AdminSessionController {
  constructor(private readonly configService: ConfigService) {}

  @Post()
  login(@Body() dto: AdminLoginDto): { token: string; username: string } {
    const adminUsername = this.configService.getOrThrow<string>('ADMIN_USERNAME');
    const adminPassword = this.configService.getOrThrow<string>('ADMIN_PASSWORD');

    if (dto.username !== adminUsername || dto.password !== adminPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const secret = this.configService.getOrThrow<string>('ADMIN_JWT_SECRET');
    const token = signAdminToken(dto.username, secret);
    return { token, username: dto.username };
  }

  @Delete()
  @UseGuards(AdminGuard)
  @HttpCode(204)
  logout(): void {
    // Stateless token — nothing to invalidate server-side.
  }
}
