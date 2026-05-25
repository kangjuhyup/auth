import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OidcInteractionPort } from '@application/ports/oidc-interaction.port';
import {
  InteractionCommandPort,
  type InteractionResponse,
} from '@application/ports/interaction-command.port';
import { UserQueryPort } from '@application/queries/ports/user-query.port';
import { LoginAttemptPolicyPort } from '@application/ports/login-attempt-policy.port';
import { OperationalMetricsPort } from '@application/ports/operational-metrics.port';
import type { TenantContext } from '@application/dto';
import { AuditRecorder } from '@application/services/audit-recorder';
import { AuthCommandPort } from '../ports/auth-command.port';

type PendingMfaSession = Readonly<{
  userId: string;
  tenantId: string;
  expiresAt: number;
}>;

type PendingPasswordChangeSession = Readonly<{
  userId: string;
  tenantId: string;
  mfaEnabled: boolean;
  expiresAt: number;
}>;

@Injectable()
export class InteractionCommandHandler
  extends InteractionCommandPort
  implements OnModuleInit, OnModuleDestroy
{
  private readonly mfaSessionTtlMs = 10 * 60 * 1000;
  private readonly passwordChangeSessionTtlMs = 10 * 60 * 1000;
  private readonly mfaCleanupIntervalMs = 5 * 60 * 1000;
  private readonly mfaPendingSessions = new Map<string, PendingMfaSession>();
  private readonly passwordChangePendingSessions = new Map<
    string,
    PendingPasswordChangeSession
  >();
  private mfaCleanupTimer: NodeJS.Timeout | undefined;

  constructor(
    private readonly userQuery: UserQueryPort,
    private readonly oidcInteraction: OidcInteractionPort,
    private readonly loginAttemptPolicy: LoginAttemptPolicyPort,
    private readonly metrics: OperationalMetricsPort,
    private readonly authCommand: AuthCommandPort,
    private readonly auditRecorder?: AuditRecorder,
  ) {
    super();
  }

  onModuleInit() {
    this.mfaCleanupTimer = setInterval(() => {
      this.deleteExpiredSessions();
    }, this.mfaCleanupIntervalMs);
    this.mfaCleanupTimer.unref();
  }

  onModuleDestroy() {
    if (this.mfaCleanupTimer) {
      clearInterval(this.mfaCleanupTimer);
    }
  }

  getDetails(params: {
    tenantCode: string;
    uid: string;
    req: unknown;
    res: unknown;
    tenant?: TenantContext;
  }) {
    return this.oidcInteraction.getDetails(params);
  }

  async submitLogin(params: {
    tenantCode: string;
    uid: string;
    username: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
    correlationId?: string;
    req: unknown;
    res: unknown;
    tenant?: TenantContext;
  }): Promise<InteractionResponse> {
    if (!params.tenant) {
      this.metrics.incrementCounter('login_failure_total', {
        tenantCode: params.tenantCode,
        reason: 'tenant_not_found',
      });
      return { status: 400, body: { error: 'tenant_not_found' } };
    }

    const attempt = {
      tenantId: params.tenant.id,
      username: params.username,
      ipAddress: params.ipAddress,
      scope: 'interaction' as const,
    };
    const decision = await this.loginAttemptPolicy.consumeAttempt(attempt);
    if (!decision.allowed) {
      this.metrics.incrementCounter('login_failure_total', {
        tenantCode: params.tenantCode,
        reason: decision.reason,
      });
      await this.recordSuspiciousLoginAudit({
        tenantId: params.tenant.id,
        username: params.username,
        reason:
          decision.reason === 'rate_limited'
            ? 'LoginRateLimited'
            : 'LoginTemporarilyLocked',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        correlationId: params.correlationId,
        metadata: {
          source: 'interaction',
          signal: decision.reason,
          retryAfterSec: decision.retryAfterSec,
        },
      });
      return {
        status: decision.reason === 'rate_limited' ? 429 : 423,
        body: {
          error:
            decision.reason === 'rate_limited'
              ? 'too_many_login_attempts'
              : 'account_temporarily_locked',
          retryAfterSec: decision.retryAfterSec,
        },
      };
    }

    const result = await this.userQuery.authenticate({
      tenantId: params.tenant.id,
      username: params.username,
      password: params.password,
    });

    if (!result) {
      const failureResult =
        await this.loginAttemptPolicy.recordFailure(attempt);
      this.metrics.incrementCounter('login_failure_total', {
        tenantCode: params.tenantCode,
        reason: 'invalid_credentials',
      });
      if (failureResult.temporarilyLocked) {
        await this.recordSuspiciousLoginAudit({
          tenantId: params.tenant.id,
          username: params.username,
          reason: 'FailureSpikeDetected',
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          correlationId: params.correlationId,
          metadata: {
            source: 'interaction',
            signal: 'failure_spike',
            failureCount: failureResult.failureCount,
            retryAfterSec: failureResult.retryAfterSec ?? null,
          },
        });
      }
      return { status: 401, body: { error: 'invalid_credentials' } };
    }

    await this.loginAttemptPolicy.recordSuccess(attempt);
    this.metrics.incrementCounter('login_success_total', {
      tenantCode: params.tenantCode,
    });

    if (result.passwordChangeRequired) {
      this.passwordChangePendingSessions.set(params.uid, {
        userId: result.userId,
        tenantId: params.tenant.id,
        mfaEnabled: result.mfaEnabled,
        expiresAt: Date.now() + this.passwordChangeSessionTtlMs,
      });

      return {
        body: {
          success: true,
          passwordChangeRequired: true,
        },
      };
    }

    return this.continueAuthenticatedLogin({
      tenantCode: params.tenantCode,
      uid: params.uid,
      tenant: params.tenant,
      userId: result.userId,
      mfaEnabled: result.mfaEnabled,
      req: params.req,
      res: params.res,
    });
  }

  async submitPasswordChange(params: {
    tenantCode: string;
    uid: string;
    currentPassword: string;
    newPassword: string;
    req: unknown;
    res: unknown;
    tenant?: TenantContext;
  }): Promise<InteractionResponse> {
    const pending = this.getPendingPasswordChangeSession(params.uid);
    if (!pending || !params.tenant || pending.tenantId !== params.tenant.id) {
      return { status: 400, body: { error: 'no_pending_password_change' } };
    }

    if (params.currentPassword === params.newPassword) {
      return { status: 400, body: { error: 'new_password_must_be_different' } };
    }

    try {
      await this.authCommand.changePassword(pending.tenantId, pending.userId, {
        currentPassword: params.currentPassword,
        newPassword: params.newPassword,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'InvalidPassword') {
        return { status: 401, body: { error: 'invalid_current_password' } };
      }
      throw error;
    }

    this.passwordChangePendingSessions.delete(params.uid);

    return this.continueAuthenticatedLogin({
      tenantCode: params.tenantCode,
      uid: params.uid,
      tenant: params.tenant,
      userId: pending.userId,
      mfaEnabled: pending.mfaEnabled,
      req: params.req,
      res: params.res,
    });
  }

  async submitMfa(params: {
    tenantCode: string;
    uid: string;
    method: 'totp' | 'webauthn' | 'recovery_code';
    code?: string;
    webauthnResponse?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    correlationId?: string;
    req: unknown;
    res: unknown;
    rpId: string;
    expectedOrigin: string;
  }): Promise<InteractionResponse> {
    const pending = this.getPendingSession(params.uid);
    if (!pending) {
      return { status: 400, body: { error: 'no_pending_mfa' } };
    }

    const verified = await this.userQuery.verifyMfa({
      tenantId: pending.tenantId,
      userId: pending.userId,
      method: params.method,
      code: params.code,
      webauthnResponse: params.webauthnResponse,
      rpId: params.rpId,
      expectedOrigin: params.expectedOrigin,
    });

    if (!verified) {
      this.metrics.incrementCounter('login_failure_total', {
        reason: 'mfa_failed',
      });
      return { status: 401, body: { error: 'mfa_failed' } };
    }

    this.mfaPendingSessions.delete(params.uid);
    if (params.method === 'recovery_code') {
      await this.auditRecorder?.recordAdminAction({
        tenantId: pending.tenantId,
        category: 'SECURITY',
        severity: 'INFO',
        action: 'UPDATE',
        resourceType: 'mfa-recovery-code',
        resourceId: pending.userId,
        success: true,
        reason: 'RecoveryCodeUsed',
        metadata: {
          method: 'recovery_code',
        },
        auditContext: {
          actorUserId: pending.userId,
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
          correlationId: params.correlationId ?? null,
        },
      });
    }

    const { redirectTo } = await this.oidcInteraction.completeLogin({
      tenantCode: params.tenantCode,
      req: params.req,
      res: params.res,
      userId: pending.userId,
    });

    return {
      body: {
        success: true,
        redirectTo,
      },
    };
  }

  async beginTotpEnrollment(params: {
    tenantCode: string;
    uid: string;
    tenant?: TenantContext;
  }): Promise<InteractionResponse> {
    const pending = this.getPendingSession(params.uid);
    if (!pending || !params.tenant || pending.tenantId !== params.tenant.id) {
      return { status: 400, body: { error: 'no_pending_mfa_enrollment' } };
    }

    const enrollment = await this.authCommand.beginTotpEnrollment(
      pending.tenantId,
      pending.userId,
    );

    return {
      body: {
        success: true,
        ...enrollment,
      },
    };
  }

  async confirmTotpEnrollment(params: {
    tenantCode: string;
    uid: string;
    code: string;
    req: unknown;
    res: unknown;
    tenant?: TenantContext;
  }): Promise<InteractionResponse> {
    const pending = this.getPendingSession(params.uid);
    if (!pending || !params.tenant || pending.tenantId !== params.tenant.id) {
      return { status: 400, body: { error: 'no_pending_mfa_enrollment' } };
    }

    let confirmation: { recoveryCodes: string[] };
    try {
      confirmation = await this.authCommand.confirmTotpEnrollment(
        pending.tenantId,
        pending.userId,
        { code: params.code },
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'InvalidTotpCode') {
        return { status: 401, body: { error: 'invalid_totp_code' } };
      }
      if (
        error instanceof Error &&
        error.message === 'TotpEnrollmentNotFound'
      ) {
        return { status: 400, body: { error: 'totp_enrollment_not_found' } };
      }
      throw error;
    }

    this.mfaPendingSessions.delete(params.uid);

    const { redirectTo } = await this.oidcInteraction.completeLogin({
      tenantCode: params.tenantCode,
      req: params.req,
      res: params.res,
      userId: pending.userId,
    });

    return {
      body: {
        success: true,
        recoveryCodes: confirmation.recoveryCodes,
        redirectTo,
      },
    };
  }

  async getWebAuthnOptions(params: {
    uid: string;
    rpId: string;
    expectedOrigin: string;
  }): Promise<InteractionResponse> {
    const pending = this.getPendingSession(params.uid);
    if (!pending) {
      return { status: 400, body: { error: 'no_pending_mfa' } };
    }

    const options = await this.userQuery.verifyMfa({
      tenantId: pending.tenantId,
      userId: pending.userId,
      method: 'webauthn',
      rpId: params.rpId,
      expectedOrigin: params.expectedOrigin,
    });

    return { body: options };
  }

  submitConsent(params: { tenantCode: string; req: unknown; res: unknown }) {
    return this.oidcInteraction.completeConsent(params);
  }

  abort(params: { tenantCode: string; req: unknown; res: unknown }) {
    return this.oidcInteraction.abort(params);
  }

  getIdpRedirect(params: {
    tenantCode: string;
    uid: string;
    providerName: string;
    req: unknown;
    res: unknown;
    tenant?: TenantContext;
  }) {
    return this.oidcInteraction.getIdpRedirect(params);
  }

  handleIdpCallback(params: {
    tenantCode: string;
    uid: string;
    providerName: string;
    req: unknown;
    res: unknown;
    tenant?: TenantContext;
  }) {
    return this.oidcInteraction.handleIdpCallback(params);
  }

  getSamlMetadata(params: {
    tenantCode: string;
    providerName: string;
    req: unknown;
    tenant?: TenantContext;
  }) {
    return this.oidcInteraction.getSamlMetadata(params);
  }

  handleSamlCallback(params: {
    tenantCode: string;
    providerName: string;
    relayState?: string;
    samlResponse?: string;
    req: unknown;
    res: unknown;
    tenant?: TenantContext;
  }) {
    return this.oidcInteraction.handleSamlCallback(params);
  }

  private async continueAuthenticatedLogin(params: {
    tenantCode: string;
    uid: string;
    tenant: TenantContext;
    userId: string;
    mfaEnabled: boolean;
    req: unknown;
    res: unknown;
  }): Promise<InteractionResponse> {
    const details = await this.oidcInteraction.getDetails({
      tenantCode: params.tenantCode,
      uid: params.uid,
      req: params.req,
      res: params.res,
      tenant: params.tenant,
    });

    const shouldRequireMfa = details.mfaRequired || params.mfaEnabled;

    if (shouldRequireMfa) {
      const methods = await this.userQuery.getMfaMethods(
        params.tenant.id,
        params.userId,
      );
      if (methods.length === 0) {
        this.metrics.incrementCounter('mfa_enrollment_required_total', {
          tenantCode: params.tenantCode,
          method: 'totp',
        });
        this.mfaPendingSessions.set(params.uid, {
          userId: params.userId,
          tenantId: params.tenant.id,
          expiresAt: Date.now() + this.mfaSessionTtlMs,
        });
        return {
          body: {
            success: true,
            mfaEnrollmentRequired: true,
            methods: ['totp'],
          },
        };
      }

      this.mfaPendingSessions.set(params.uid, {
        userId: params.userId,
        tenantId: params.tenant.id,
        expiresAt: Date.now() + this.mfaSessionTtlMs,
      });

      return {
        body: {
          success: true,
          mfaRequired: true,
          methods,
        },
      };
    }

    const { redirectTo } = await this.oidcInteraction.completeLogin({
      tenantCode: params.tenantCode,
      req: params.req,
      res: params.res,
      userId: params.userId,
    });

    return {
      body: {
        success: true,
        mfaRequired: false,
        redirectTo,
      },
    };
  }

  private getPendingSession(uid: string): PendingMfaSession | null {
    const pending = this.mfaPendingSessions.get(uid);
    if (!pending || pending.expiresAt <= Date.now()) {
      this.mfaPendingSessions.delete(uid);
      return null;
    }
    return pending;
  }

  private getPendingPasswordChangeSession(
    uid: string,
  ): PendingPasswordChangeSession | null {
    const pending = this.passwordChangePendingSessions.get(uid);
    if (!pending || pending.expiresAt <= Date.now()) {
      this.passwordChangePendingSessions.delete(uid);
      return null;
    }
    return pending;
  }

  private deleteExpiredSessions() {
    const now = Date.now();
    for (const [uid, session] of this.mfaPendingSessions) {
      if (session.expiresAt <= now) {
        this.mfaPendingSessions.delete(uid);
      }
    }
    for (const [uid, session] of this.passwordChangePendingSessions) {
      if (session.expiresAt <= now) {
        this.passwordChangePendingSessions.delete(uid);
      }
    }
  }

  private async recordSuspiciousLoginAudit(params: {
    tenantId: string;
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
      resourceType: 'login-risk',
      resourceId: params.username,
      success: false,
      reason: params.reason,
      metadata: params.metadata,
      auditContext: {
        actorUsername: params.username,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        correlationId: params.correlationId ?? null,
      },
    });
  }
}
