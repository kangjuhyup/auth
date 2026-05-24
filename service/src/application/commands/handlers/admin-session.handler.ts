import { Injectable } from '@nestjs/common';
import { TenantRepository } from '@domain/repositories';
import { AdminQueryPort } from '@application/queries/ports';
import { UserQueryPort } from '@application/queries/ports/user-query.port';
import { AdminSessionPort } from '@application/ports/admin-session.port';
import { AdminSessionTokenPort } from '@application/ports/admin-session-token.port';
import { LoginAttemptPolicyPort } from '@application/ports/login-attempt-policy.port';
import { AuditRecorder } from '@application/services/audit-recorder';

const MASTER_TENANT = 'master';
const ADMIN_ROLE = 'SUPER_ADMIN';

@Injectable()
export class AdminSessionHandler extends AdminSessionPort {
  constructor(
    private readonly tenantRepo: TenantRepository,
    private readonly userQuery: UserQueryPort,
    private readonly adminQuery: AdminQueryPort,
    private readonly tokenPort: AdminSessionTokenPort,
    private readonly loginAttemptPolicy: LoginAttemptPolicyPort,
    private readonly auditRecorder?: AuditRecorder,
  ) {
    super();
  }

  async issueAdminToken(params: {
    username: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
    correlationId?: string;
  }) {
    const tenant = await this.tenantRepo.findByCode(MASTER_TENANT);
    if (!tenant) {
      return null;
    }

    const attempt = {
      tenantId: tenant.id,
      username: params.username,
      ipAddress: params.ipAddress,
      scope: 'admin' as const,
    };
    const decision = await this.loginAttemptPolicy.consumeAttempt(attempt);
    if (!decision.allowed) {
      await this.recordAdminLoginAudit({
        tenantId: tenant.id,
        username: params.username,
        success: false,
        reason: decision.reason,
        severity: 'WARN',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        correlationId: params.correlationId,
      });
      return {
        blocked: true as const,
        reason: decision.reason,
        retryAfterSec: decision.retryAfterSec,
      };
    }

    const result = await this.userQuery.authenticate({
      tenantId: tenant.id,
      username: params.username,
      password: params.password,
    });
    if (!result) {
      await this.loginAttemptPolicy.recordFailure(attempt);
      await this.recordAdminLoginAudit({
        tenantId: tenant.id,
        username: params.username,
        success: false,
        reason: 'InvalidCredentials',
        severity: 'WARN',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        correlationId: params.correlationId,
      });
      return null;
    }

    const roles = await this.adminQuery.getUserRoles(tenant.id, result.userId);
    if (!roles.some((role) => role.code === ADMIN_ROLE)) {
      await this.loginAttemptPolicy.recordFailure(attempt);
      await this.recordAdminLoginAudit({
        tenantId: tenant.id,
        userId: result.userId,
        username: params.username,
        success: false,
        reason: 'MissingSuperAdminRole',
        severity: 'WARN',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        correlationId: params.correlationId,
      });
      return null;
    }

    const token = await this.tokenPort.issue({
      tenantCode: MASTER_TENANT,
      userId: result.userId,
    });
    if (!token) {
      await this.recordAdminLoginAudit({
        tenantId: tenant.id,
        userId: result.userId,
        username: params.username,
        success: false,
        reason: 'TokenIssueFailed',
        severity: 'ERROR',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        correlationId: params.correlationId,
      });
      return null;
    }

    await this.loginAttemptPolicy.recordSuccess(attempt);
    await this.recordAdminLoginAudit({
      tenantId: tenant.id,
      userId: result.userId,
      username: params.username,
      success: true,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      correlationId: params.correlationId,
    });

    return { token, username: params.username };
  }

  async verifyAdminToken(token: string): Promise<boolean> {
    const session = await this.getVerifiedSession(token);
    return session !== null;
  }

  async getAdminSession(
    token: string,
  ): Promise<{ userId: string; username: string } | null> {
    const session = await this.getVerifiedSession(token);
    if (!session) {
      return null;
    }

    return session;
  }

  private async getVerifiedSession(
    token: string,
  ): Promise<{ userId: string; username: string } | null> {
    const tenant = await this.tenantRepo.findByCode(MASTER_TENANT);
    if (!tenant) {
      return null;
    }

    const verified = await this.tokenPort.verify({
      tenantCode: MASTER_TENANT,
      token,
    });
    if (!verified) {
      return null;
    }

    const roles = await this.adminQuery.getUserRoles(
      tenant.id,
      verified.userId,
    );
    if (!roles.some((role) => role.code === ADMIN_ROLE)) {
      return null;
    }

    const profile = await this.userQuery.findProfile({
      tenantId: tenant.id,
      userId: verified.userId,
    });
    if (!profile) {
      return null;
    }

    return { userId: verified.userId, username: profile.username };
  }

  private async recordAdminLoginAudit(params: {
    tenantId: string;
    userId?: string;
    username: string;
    success: boolean;
    reason?: string;
    severity?: 'INFO' | 'WARN' | 'ERROR';
    ipAddress?: string;
    userAgent?: string;
    correlationId?: string;
  }): Promise<void> {
    await this.auditRecorder?.recordAdminAction({
      tenantId: params.tenantId,
      category: params.success ? 'AUTH' : 'SECURITY',
      severity: params.severity ?? 'INFO',
      action: params.success ? 'LOGIN' : 'ACCESS_DENIED',
      resourceType: 'admin-session',
      resourceId: params.username,
      success: params.success,
      reason: params.reason ?? null,
      auditContext: {
        actorUserId: params.userId ?? null,
        actorUsername: params.username,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        correlationId: params.correlationId ?? null,
      },
    });
  }
}
