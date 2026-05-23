import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '@presentation/http/admin.guard';
import { AdminSessionPort } from '@application/ports/admin-session.port';

interface AdminLoginDto {
  username: string;
  password: string;
}

@Controller('admin/session')
export class AdminSessionController {
  constructor(private readonly adminSession: AdminSessionPort) {}

  @Post()
  async login(
    @Body() dto: AdminLoginDto,
  ): Promise<{ token: string; username: string }> {
    const result = await this.adminSession.issueAdminToken(dto);
    if (!result) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return result;
  }

  @Delete()
  @UseGuards(AdminGuard)
  @HttpCode(204)
  async logout(): Promise<void> {
    // Token is stored in the OIDC adapter — expiry is handled by TTL.
    // Active revocation can be added here if needed.
  }
}
