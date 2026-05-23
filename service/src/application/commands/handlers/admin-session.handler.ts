import { Injectable } from '@nestjs/common';
import { TenantRepository } from '@domain/repositories';
import { AdminQueryPort } from '@application/queries/ports';
import { UserQueryPort } from '@application/queries/ports/user-query.port';
import { AdminSessionPort } from '@application/ports/admin-session.port';
import { AdminSessionTokenPort } from '@application/ports/admin-session-token.port';

const MASTER_TENANT = 'master';
const ADMIN_ROLE = 'SUPER_ADMIN';

@Injectable()
export class AdminSessionHandler extends AdminSessionPort {
  constructor(
    private readonly tenantRepo: TenantRepository,
    private readonly userQuery: UserQueryPort,
    private readonly adminQuery: AdminQueryPort,
    private readonly tokenPort: AdminSessionTokenPort,
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

    const token = await this.tokenPort.issue({
      tenantCode: MASTER_TENANT,
      userId: result.userId,
    });
    if (!token) {
      return null;
    }

    return { token, username: params.username };
  }

  async verifyAdminToken(token: string): Promise<boolean> {
    const tenant = await this.tenantRepo.findByCode(MASTER_TENANT);
    if (!tenant) {
      return false;
    }

    const verified = await this.tokenPort.verify({
      tenantCode: MASTER_TENANT,
      token,
    });
    if (!verified) {
      return false;
    }

    const roles = await this.adminQuery.getUserRoles(
      tenant.id,
      verified.userId,
    );
    return roles.some((role) => role.code === ADMIN_ROLE);
  }
}
