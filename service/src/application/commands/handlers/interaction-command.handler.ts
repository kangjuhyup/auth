import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OidcInteractionPort } from '@application/ports/oidc-interaction.port';
import {
  InteractionCommandPort,
  type InteractionResponse,
} from '@application/ports/interaction-command.port';
import { UserQueryPort } from '@application/queries/ports/user-query.port';
import type { TenantContext } from '@application/dto';

type PendingMfaSession = Readonly<{
  userId: string;
  tenantId: string;
  expiresAt: number;
}>;

@Injectable()
export class InteractionCommandHandler
  extends InteractionCommandPort
  implements OnModuleInit, OnModuleDestroy
{
  private readonly mfaSessionTtlMs = 10 * 60 * 1000;
  private readonly mfaCleanupIntervalMs = 5 * 60 * 1000;
  private readonly mfaPendingSessions = new Map<string, PendingMfaSession>();
  private mfaCleanupTimer: NodeJS.Timeout | undefined;

  constructor(
    private readonly userQuery: UserQueryPort,
    private readonly oidcInteraction: OidcInteractionPort,
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
    req: unknown;
    res: unknown;
    tenant?: TenantContext;
  }): Promise<InteractionResponse> {
    if (!params.tenant) {
      return { status: 400, body: { error: 'tenant_not_found' } };
    }

    const result = await this.userQuery.authenticate({
      tenantId: params.tenant.id,
      username: params.username,
      password: params.password,
    });

    if (!result) {
      return { status: 401, body: { error: 'invalid_credentials' } };
    }

    const details = await this.oidcInteraction.getDetails({
      tenantCode: params.tenantCode,
      uid: params.uid,
      req: params.req,
      res: params.res,
      tenant: params.tenant,
    });

    if (details.mfaRequired) {
      const methods = await this.userQuery.getMfaMethods(
        params.tenant.id,
        result.userId,
      );
      if (methods.length > 0) {
        this.mfaPendingSessions.set(params.uid, {
          userId: result.userId,
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
    }

    const { redirectTo } = await this.oidcInteraction.completeLogin({
      tenantCode: params.tenantCode,
      req: params.req,
      res: params.res,
      userId: result.userId,
    });

    return {
      body: {
        success: true,
        mfaRequired: false,
        redirectTo,
      },
    };
  }

  async submitMfa(params: {
    tenantCode: string;
    uid: string;
    method: 'totp' | 'webauthn' | 'recovery_code';
    code?: string;
    webauthnResponse?: Record<string, unknown>;
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
      return { status: 401, body: { error: 'mfa_failed' } };
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

  private getPendingSession(uid: string): PendingMfaSession | null {
    const pending = this.mfaPendingSessions.get(uid);
    if (!pending || pending.expiresAt <= Date.now()) {
      this.mfaPendingSessions.delete(uid);
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
  }
}
