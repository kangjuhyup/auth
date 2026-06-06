import { Injectable } from '@nestjs/common';
import { TenantRepository } from '@domain/repositories';
import { AdminQueryPort } from '@application/queries/ports';
import { UserQueryPort } from '@application/queries/ports/user-query.port';
import { AdminSessionPort } from '@application/ports/admin-session.port';
import { AdminSessionTokenPort } from '@application/ports/admin-session-token.port';
import { LoginAttemptPolicyPort } from '@application/ports/login-attempt-policy.port';
import { AuditRecorder } from '@application/services/audit-recorder';
import { AuthCommandPort } from '../ports/auth-command.port';

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
    private readonly authCommand: AuthCommandPort,
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
      await this.recordSuspiciousAdminLoginAudit({
        tenantId: tenant.id,
        username: params.username,
        reason:
          decision.reason === 'rate_limited'
            ? 'LoginRateLimited'
            : 'LoginTemporarilyLocked',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        correlationId: params.correlationId,
        metadata: {
          source: 'admin',
          signal: decision.reason,
          retryAfterSec: decision.retryAfterSec,
        },
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
      const failureResult =
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
      if (failureResult.temporarilyLocked) {
        await this.recordSuspiciousAdminLoginAudit({
          tenantId: tenant.id,
          username: params.username,
          reason: 'FailureSpikeDetected',
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          correlationId: params.correlationId,
          metadata: {
            source: 'admin',
            signal: 'failure_spike',
            failureCount: failureResult.failureCount,
            retryAfterSec: failureResult.retryAfterSec ?? null,
          },
        });
      }
      return null;
    }

    const roles = await this.adminQuery.getUserRoles(tenant.id, result.userId);
    if (!roles.some((role) => role.code === ADMIN_ROLE)) {
      const failureResult =
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
      if (failureResult.temporarilyLocked) {
        await this.recordSuspiciousAdminLoginAudit({
          tenantId: tenant.id,
          userId: result.userId,
          username: params.username,
          reason: 'FailureSpikeDetected',
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          correlationId: params.correlationId,
          metadata: {
            source: 'admin',
            signal: 'failure_spike',
            failureCount: failureResult.failureCount,
            retryAfterSec: failureResult.retryAfterSec ?? null,
          },
        });
      }
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

    return {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      username: params.username,
      passwordChangeRequired: result.passwordChangeRequired,
    };
  }

  async refreshAdminSession(refreshToken: string) {
    const tenant = await this.tenantRepo.findByCode(MASTER_TENANT);
    if (!tenant) {
      return null;
    }

    const rotated = await this.tokenPort.refresh({
      tenantCode: MASTER_TENANT,
      refreshToken,
    });
    if (!rotated) {
      return null;
    }

    const roles = await this.adminQuery.getUserRoles(tenant.id, rotated.userId);
    if (!roles.some((role) => role.code === ADMIN_ROLE)) {
      return null;
    }

    const profile = await this.userQuery.findProfile({
      tenantId: tenant.id,
      userId: rotated.userId,
    });
    if (!profile) {
      return null;
    }

    return {
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
      username: profile.username,
      passwordChangeRequired: profile.passwordChangeRequired === true,
    };
  }

  async verifyAdminToken(token: string): Promise<boolean> {
    const session = await this.getVerifiedSession(token);
    return session !== null;
  }

  async getAdminSession(token: string) {
    const session = await this.getVerifiedSession(token);
    if (!session) {
      return null;
    }

    return session;
  }

  async changePassword(
    token: string,
    dto: { currentPassword: string; newPassword: string },
  ): Promise<void> {
    const tenant = await this.tenantRepo.findByCode(MASTER_TENANT);
    if (!tenant) {
      return;
    }

    const session = await this.getVerifiedSession(token);
    if (!session) {
      return;
    }

    await this.authCommand.changePassword(tenant.id, session.userId, dto);
  }

  private async getVerifiedSession(token: string): Promise<{
    userId: string;
    username: string;
    passwordChangeRequired: boolean;
  } | null> {
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

    return {
      userId: verified.userId,
      username: profile.username,
      passwordChangeRequired: profile.passwordChangeRequired === true,
    };
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

  private async recordSuspiciousAdminLoginAudit(params: {
    tenantId: string;
    userId?: string;
    username: string;
    reason: string;
    ipAddress?: string;
    userAgent?: string;
    correlationId?: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    await this.auditRecorder?.recordAdminAction({
      tenantId: params.tenantId,
      category: 'SECURITY',
      severity: 'WARN',
      action: 'ACCESS_DENIED',
      resourceType: 'admin-login-risk',
      resourceId: params.username,
      success: false,
      reason: params.reason,
      metadata: params.metadata,
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
