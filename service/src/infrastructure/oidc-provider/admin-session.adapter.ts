import { Inject, Injectable } from '@nestjs/common';
import { AdminSessionPort } from '@application/ports/admin-session.port';
import { AdminQueryPort } from '@application/queries/ports';
import { UserQueryPort } from '@application/queries/ports/user-query.port';
import { TenantRepository } from '@domain/repositories';
import { OIDC_PROVIDER } from './oidc-provider.constants';
import { OidcProviderRegistry } from './oidc-provider.registry';

const MASTER_TENANT = 'master';
const ADMIN_ROLE = 'SUPER_ADMIN';
const ADMIN_CLIENT_ID = '__admin-portal__';

@Injectable()
export class AdminSessionAdapter extends AdminSessionPort {
  constructor(
    @Inject(OIDC_PROVIDER) private readonly registry: OidcProviderRegistry,
    private readonly userQuery: UserQueryPort,
    private readonly adminQuery: AdminQueryPort,
    private readonly tenantRepo: TenantRepository,
  ) {
    super();
  }

  async issueAdminToken(params: {
    username: string;
    password: string;
  }): Promise<{ token: string; username: string } | null> {
    const tenant = await this.tenantRepo.findByCode(MASTER_TENANT);
    if (!tenant) {
      return null;
    }

    const result = await this.userQuery.authenticate({
      tenantId: tenant.id,
      username: params.username,
      password: params.password,
    });
    if (!result) {
      return null;
    }

    const roles = await this.adminQuery.getUserRoles(tenant.id, result.userId);
    if (!roles.some((role) => role.code === ADMIN_ROLE)) {
      return null;
    }

    const provider = await this.registry.get(MASTER_TENANT);
    const client = await (provider as any).Client.find(ADMIN_CLIENT_ID);
    if (!client) {
      return null;
    }

    const at = new (provider as any).AccessToken({
      accountId: result.userId,
      client,
      scope: 'openid profile',
    });

    const token: string = await at.save();
    return { token, username: params.username };
  }

  async verifyAdminToken(token: string): Promise<boolean> {
    const tenant = await this.tenantRepo.findByCode(MASTER_TENANT);
    if (!tenant) {
      return false;
    }

    const provider = await this.registry.get(MASTER_TENANT);
    const at = await (provider as any).AccessToken.find(token);
    if (!at) {
      return false;
    }

    const exp: number | undefined =
      at.exp ?? at.payload?.exp ?? at.toJSON?.()?.payload?.exp;
    if (typeof exp === 'number' && Math.floor(Date.now() / 1000) >= exp) {
      return false;
    }

    const userId: string | undefined = at.accountId ?? at.payload?.sub;
    if (!userId) {
      return false;
    }

    const roles = await this.adminQuery.getUserRoles(tenant.id, userId);
    return roles.some((role) => role.code === ADMIN_ROLE);
  }
}
