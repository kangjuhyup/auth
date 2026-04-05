import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { OIDC_PROVIDER } from '@infrastructure/oidc-provider/oidc-provider.constants';
import { OidcProviderRegistry } from '@infrastructure/oidc-provider/oidc-provider.registry';
import { TenantRepository } from '@domain/repositories';
import { AdminQueryPort } from '@application/queries/ports';

const MASTER_TENANT_CODE = 'master';
const ADMIN_ROLE_CODE = 'SUPER_ADMIN';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @Inject(OIDC_PROVIDER) private readonly registry: OidcProviderRegistry,
    private readonly tenantRepo: TenantRepository,
    private readonly adminQuery: AdminQueryPort,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const auth = req.headers['authorization'];
    if (!auth?.startsWith('Bearer ')) return false;

    const token = auth.slice(7).trim();
    if (!token) return false;

    try {
      const tenant = await this.tenantRepo.findByCode(MASTER_TENANT_CODE);
      if (!tenant) return false;

      const provider = await this.registry.get(MASTER_TENANT_CODE);
      const at = await (provider as any).AccessToken.find(token);
      if (!at) return false;

      const exp: number | undefined =
        at.exp ?? at.payload?.exp ?? at.toJSON?.()?.payload?.exp;
      if (typeof exp === 'number' && Math.floor(Date.now() / 1000) >= exp) {
        return false;
      }

      const userId: string | undefined = at.accountId ?? at.payload?.sub;
      if (!userId) return false;

      const roles = await this.adminQuery.getUserRoles(tenant.id, userId);
      return roles.some((r) => r.code === ADMIN_ROLE_CODE);
    } catch {
      return false;
    }
  }
}
