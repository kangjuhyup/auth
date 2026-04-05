import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Inject,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '@presentation/http/admin.guard';
import { UserQueryPort } from '@application/queries/ports/user-query.port';
import { AdminQueryPort } from '@application/queries/ports';
import { TenantRepository } from '@domain/repositories';
import { OIDC_PROVIDER } from '@infrastructure/oidc-provider/oidc-provider.constants';
import { OidcProviderRegistry } from '@infrastructure/oidc-provider/oidc-provider.registry';

interface AdminLoginDto {
  username: string;
  password: string;
}

const MASTER_TENANT = 'master';
const ADMIN_ROLE = 'SUPER_ADMIN';
const ADMIN_CLIENT_ID = '__admin-portal__';

@Controller('admin/session')
export class AdminSessionController {
  constructor(
    @Inject(OIDC_PROVIDER) private readonly registry: OidcProviderRegistry,
    private readonly userQuery: UserQueryPort,
    private readonly adminQuery: AdminQueryPort,
    private readonly tenantRepo: TenantRepository,
  ) {}

  @Post()
  async login(@Body() dto: AdminLoginDto): Promise<{ token: string; username: string }> {
    const tenant = await this.tenantRepo.findByCode(MASTER_TENANT);
    if (!tenant) {
      throw new UnauthorizedException('master tenant not found');
    }

    const result = await this.userQuery.authenticate({
      tenantId: tenant.id,
      username: dto.username,
      password: dto.password,
    });

    if (!result) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const roles = await this.adminQuery.getUserRoles(tenant.id, result.userId);
    if (!roles.some((r) => r.code === ADMIN_ROLE)) {
      throw new UnauthorizedException('Insufficient permissions');
    }

    const provider = await this.registry.get(MASTER_TENANT);
    const client = await (provider as any).Client.find(ADMIN_CLIENT_ID);
    if (!client) {
      throw new UnauthorizedException('admin-portal client not configured');
    }

    const at = new (provider as any).AccessToken({
      accountId: result.userId,
      client,
      scope: 'openid profile',
    });

    const token: string = await at.save();
    return { token, username: dto.username };
  }

  @Delete()
  @UseGuards(AdminGuard)
  @HttpCode(204)
  async logout(): Promise<void> {
    // Token is stored in the OIDC adapter — expiry is handled by TTL.
    // Active revocation can be added here if needed.
  }
}
