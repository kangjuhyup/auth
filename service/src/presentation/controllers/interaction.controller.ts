import {
  Body,
  Controller,
  Get,
  Inject,
  OnModuleDestroy,
  OnModuleInit,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { OIDC_PROVIDER } from '@infrastructure/oidc-provider/oidc-provider.constants';
import { OidcProviderRegistry } from '@infrastructure/oidc-provider/oidc-provider.registry';
import { UserQueryPort } from '@application/queries/ports/user-query.port';
import {
  ClientAuthPolicyRepository,
  IdentityProviderRepository,
  UserIdentityRepository,
} from '@domain/repositories';
import { ClientRepository } from '@domain/repositories';
import { IdpPort } from '@application/ports/idp.port';
import { randomBytes } from 'node:crypto';

const SPA_INDEX_PATH = resolve(
  __dirname,
  '../../../interaction-ui/dist/index.html',
);

@Controller('t/:tenantCode/interaction')
export class InteractionController implements OnModuleInit, OnModuleDestroy {
  private readonly MFA_SESSION_TTL_MS = 10 * 60 * 1000;
  private readonly MFA_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

  private readonly mfaPendingSessions = new Map<
    string,
    { userId: string; tenantId: string; expiresAt: number }
  >();
  private mfaCleanupTimer: NodeJS.Timeout | undefined;

  private cachedSpaHtml: string | null = null;

  constructor(
    @Inject(OIDC_PROVIDER)
    private readonly registry: OidcProviderRegistry,
    private readonly userQuery: UserQueryPort,
    private readonly clientAuthPolicyRepo: ClientAuthPolicyRepository,
    private readonly clientRepo: ClientRepository,
    private readonly idpRepo: IdentityProviderRepository,
    private readonly userIdentityRepo: UserIdentityRepository,
    private readonly idpPort: IdpPort,
  ) {}

  onModuleInit() {
    this.mfaCleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [uid, session] of this.mfaPendingSessions) {
        if (session.expiresAt <= now) {
          this.mfaPendingSessions.delete(uid);
        }
      }
    }, this.MFA_CLEANUP_INTERVAL_MS);
    this.mfaCleanupTimer.unref();
  }

  onModuleDestroy() {
    if (this.mfaCleanupTimer) {
      clearInterval(this.mfaCleanupTimer);
    }
  }

  /* ─── SPA Entry Point ─── */

  @Get(':uid')
  serveSpa(@Res() res: Response) {
    if (!this.cachedSpaHtml) {
      if (!existsSync(SPA_INDEX_PATH)) {
        return res.status(404).json({ error: 'Interaction UI not built' });
      }
      this.cachedSpaHtml = readFileSync(SPA_INDEX_PATH, 'utf-8');
    }
    return res.type('html').send(this.cachedSpaHtml);
  }

  /* ─── JSON API Endpoints ─── */

  @Get(':uid/api/details')
  async getDetails(
    @Param('tenantCode') tenantCode: string,
    @Param('uid') uid: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const provider = await this.registry.get(tenantCode);
    const details = await provider.interactionDetails(req as any, res as any);
    const { prompt, params } = details;
    const clientId = String(params.client_id ?? '');
    const tenant = (req as any).tenant as { id: string } | undefined;

    let idpList: { provider: string; name: string }[] = [];
    let mfaRequired = false;

    if (tenant) {
      const idps = await this.idpRepo.listEnabledByTenant(tenant.id);
      idpList = idps.map((idp) => ({
        provider: idp.provider,
        name: idp.displayName,
      }));

      const client = await this.clientRepo.findByClientId(tenant.id, clientId);
      if (client) {
        const policy = await this.clientAuthPolicyRepo.findByClientRefId(
          client.id,
        );
        if (policy) {
          mfaRequired = policy.mfaRequired;
        }
      }
    }

    let missingScopes: string[] = [];
    if (prompt.name === 'consent') {
      missingScopes =
        ((prompt.details as any).missingOIDCScope as string[] | undefined) ??
        [];
    }

    return res.json({
      uid,
      prompt: prompt.name,
      clientId,
      missingScopes,
      mfaRequired,
      idpList,
    });
  }

  @Post(':uid/api/login')
  async submitLogin(
    @Param('tenantCode') tenantCode: string,
    @Param('uid') uid: string,
    @Body() body: { username?: string; password?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tenant = (req as any).tenant as { id: string } | undefined;
    if (!tenant) {
      return res.status(400).json({ error: 'tenant_not_found' });
    }

    const result = await this.userQuery.authenticate({
      tenantId: tenant.id,
      username: body.username ?? '',
      password: body.password ?? '',
    });

    if (!result) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    const provider = await this.registry.get(tenantCode);
    const details = await provider.interactionDetails(req as any, res as any);
    const clientId = String(details.params.client_id ?? '');

    const client = await this.clientRepo.findByClientId(tenant.id, clientId);
    if (client) {
      const policy = await this.clientAuthPolicyRepo.findByClientRefId(
        client.id,
      );
      if (policy?.mfaRequired) {
        const methods = await this.userQuery.getMfaMethods(
          tenant.id,
          result.userId,
        );

        if (methods.length > 0) {
          this.mfaPendingSessions.set(uid, {
            userId: result.userId,
            tenantId: tenant.id,
            expiresAt: Date.now() + this.MFA_SESSION_TTL_MS,
          });

          return res.json({
            success: true,
            mfaRequired: true,
            methods,
          });
        }
      }
    }

    const redirectTo = await provider.interactionResult(
      req as any,
      res as any,
      { login: { accountId: result.userId } },
    );

    return res.json({ success: true, mfaRequired: false, redirectTo });
  }

  @Post(':uid/api/mfa')
  async submitMfa(
    @Param('tenantCode') tenantCode: string,
    @Param('uid') uid: string,
    @Body()
    body: {
      method: 'totp' | 'webauthn' | 'recovery_code';
      code?: string;
      webauthnResponse?: Record<string, unknown>;
    },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const pending = this.mfaPendingSessions.get(uid);
    if (!pending || pending.expiresAt <= Date.now()) {
      this.mfaPendingSessions.delete(uid);
      return res.status(400).json({ error: 'no_pending_mfa' });
    }

    const host = req.get('host') ?? 'localhost';
    const rpId = host.split(':')[0];
    const origin = `${req.protocol}://${host}`;

    const verified = await this.userQuery.verifyMfa({
      tenantId: pending.tenantId,
      userId: pending.userId,
      method: body.method,
      code: body.code,
      webauthnResponse: body.webauthnResponse,
      rpId,
      expectedOrigin: origin,
    });

    if (!verified) {
      return res.status(401).json({ error: 'mfa_failed' });
    }

    this.mfaPendingSessions.delete(uid);

    const provider = await this.registry.get(tenantCode);
    const redirectTo = await provider.interactionResult(
      req as any,
      res as any,
      { login: { accountId: pending.userId } },
    );

    return res.json({ success: true, redirectTo });
  }

  @Post(':uid/api/consent')
  async submitConsent(
    @Param('tenantCode') tenantCode: string,
    @Param('uid') uid: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const provider = await this.registry.get(tenantCode);
    const details = await provider.interactionDetails(req as any, res as any);
    const { prompt, params, session } = details;

    if (prompt.name !== 'consent' || !session) {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'No active consent interaction',
      });
    }

    const accountId = session.accountId;
    const clientId = params.client_id as string;

    let grant: InstanceType<typeof provider.Grant>;
    if (details.grantId) {
      const existing = await provider.Grant.find(details.grantId);
      grant = existing ?? new provider.Grant({ accountId, clientId });
    } else {
      grant = new provider.Grant({ accountId, clientId });
    }

    const missingScope =
      ((prompt.details as any).missingOIDCScope as string[] | undefined) ?? [];
    if (missingScope.length) {
      grant.addOIDCScope(missingScope.join(' '));
    }

    const grantId = await grant.save();

    const redirectTo = await provider.interactionResult(
      req as any,
      res as any,
      { consent: { grantId } },
    );

    return res.json({ success: true, redirectTo });
  }

  @Get(':uid/api/abort')
  async abortInteraction(
    @Param('tenantCode') tenantCode: string,
    @Param('uid') uid: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const provider = await this.registry.get(tenantCode);

    const redirectTo = await provider.interactionResult(
      req as any,
      res as any,
      {
        error: 'access_denied',
        error_description: 'End-User aborted interaction',
      },
    );

    return res.json({ redirectTo });
  }

  /* ─── WebAuthn Options (pre-MFA) ─── */

  @Get(':uid/api/mfa/webauthn-options')
  async getWebAuthnOptions(
    @Param('uid') uid: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const pending = this.mfaPendingSessions.get(uid);
    if (!pending || pending.expiresAt <= Date.now()) {
      this.mfaPendingSessions.delete(uid);
      return res.status(400).json({ error: 'no_pending_mfa' });
    }

    const host = req.get('host') ?? 'localhost';
    const rpId = host.split(':')[0];

    const options = await this.userQuery.verifyMfa({
      tenantId: pending.tenantId,
      userId: pending.userId,
      method: 'webauthn',
      rpId,
      expectedOrigin: `${req.protocol}://${host}`,
    });

    return res.json(options);
  }

  /* ─── IdP Endpoints ─── */

  @Get(':uid/idp/:provider')
  async redirectToIdp(
    @Param('tenantCode') tenantCode: string,
    @Param('uid') uid: string,
    @Param('provider') providerName: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tenant = (req as any).tenant as { id: string } | undefined;
    if (!tenant) {
      return res.status(400).json({ error: 'tenant_not_found' });
    }

    const idpConfig = await this.idpRepo.findByTenantAndProvider(
      tenant.id,
      providerName,
    );
    if (!idpConfig || !idpConfig.enabled) {
      return res.status(404).json({ error: 'idp_not_found' });
    }

    const state = `${uid}:${randomBytes(16).toString('hex')}`;
    const callbackUrl = `${req.protocol}://${req.get('host')}/t/${tenantCode}/interaction/${uid}/idp/${providerName}/callback`;

    const authUrl = this.idpPort.getAuthorizationUrl(
      idpConfig.provider,
      idpConfig.oauthConfig,
      idpConfig.clientId,
      callbackUrl,
      state,
    );

    return res.redirect(authUrl);
  }

  @Get(':uid/idp/:provider/callback')
  async idpCallback(
    @Param('tenantCode') tenantCode: string,
    @Param('uid') uid: string,
    @Param('provider') providerName: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tenant = (req as any).tenant as { id: string } | undefined;
    if (!tenant) {
      return res.redirect(
        `/t/${tenantCode}/interaction/${uid}?error=tenant_not_found`,
      );
    }

    const code = req.query.code as string | undefined;
    if (!code) {
      return res.redirect(
        `/t/${tenantCode}/interaction/${uid}?error=idp_no_code`,
      );
    }

    const idpConfig = await this.idpRepo.findByTenantAndProvider(
      tenant.id,
      providerName,
    );
    if (!idpConfig) {
      return res.redirect(
        `/t/${tenantCode}/interaction/${uid}?error=idp_not_found`,
      );
    }

    try {
      const callbackUrl = `${req.protocol}://${req.get('host')}/t/${tenantCode}/interaction/${uid}/idp/${providerName}/callback`;

      const userInfo = await this.idpPort.exchangeCode(
        idpConfig.provider,
        idpConfig.oauthConfig,
        idpConfig.clientId,
        idpConfig.clientSecret,
        code,
        callbackUrl,
      );

      const identity = await this.userIdentityRepo.findByProviderSub(
        tenant.id,
        providerName,
        userInfo.sub,
      );

      if (!identity) {
        // TODO: 신규 유저 생성 또는 기존 유저 연결 로직
        return res.redirect(
          `/t/${tenantCode}/interaction/${uid}?error=idp_user_not_linked`,
        );
      }

      const provider = await this.registry.get(tenantCode);
      await provider.interactionFinished(req as any, res as any, {
        login: { accountId: identity.userId },
      });
    } catch {
      return res.redirect(
        `/t/${tenantCode}/interaction/${uid}?error=idp_exchange_failed`,
      );
    }
  }
}
