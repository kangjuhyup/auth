import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

    return { token: `admin-session-${Date.now()}`, username: dto.username };
  }
}
