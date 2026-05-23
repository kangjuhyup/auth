import {
  Body,
  Controller,
  Get,
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
import { UserQueryPort } from '@application/queries/ports/user-query.port';
import { OidcInteractionPort } from '@application/ports/oidc-interaction.port';
import type { TenantContext } from '@application/dto';

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
    private readonly userQuery: UserQueryPort,
    private readonly oidcInteraction: OidcInteractionPort,
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

  @Get(':uid/api/details')
  async getDetails(
    @Param('tenantCode') tenantCode: string,
    @Param('uid') uid: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const details = await this.oidcInteraction.getDetails({
      tenantCode,
      uid,
      req,
      res,
      tenant: this.getTenant(req),
    });

    return res.json(details);
  }

  @Post(':uid/api/login')
  async submitLogin(
    @Param('tenantCode') tenantCode: string,
    @Param('uid') uid: string,
    @Body() body: { username?: string; password?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tenant = this.getTenant(req);
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

    const details = await this.oidcInteraction.getDetails({
      tenantCode,
      uid,
      req,
      res,
      tenant,
    });

    if (details.mfaRequired) {
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

    const { redirectTo } = await this.oidcInteraction.completeLogin({
      tenantCode,
      req,
      res,
      userId: result.userId,
    });

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
    const verified = await this.userQuery.verifyMfa({
      tenantId: pending.tenantId,
      userId: pending.userId,
      method: body.method,
      code: body.code,
      webauthnResponse: body.webauthnResponse,
      rpId: host.split(':')[0],
      expectedOrigin: `${req.protocol}://${host}`,
    });

    if (!verified) {
      return res.status(401).json({ error: 'mfa_failed' });
    }

    this.mfaPendingSessions.delete(uid);

    const { redirectTo } = await this.oidcInteraction.completeLogin({
      tenantCode,
      req,
      res,
      userId: pending.userId,
    });

    return res.json({ success: true, redirectTo });
  }

  @Post(':uid/api/consent')
  async submitConsent(
    @Param('tenantCode') tenantCode: string,
    @Param('uid') _uid: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.oidcInteraction.completeConsent({
      tenantCode,
      req,
      res,
    });
    if ('body' in result) {
      return res.status(result.status ?? 200).json(result.body);
    }

    return res.json({ success: true, redirectTo: result.redirectTo });
  }

  @Get(':uid/api/abort')
  async abortInteraction(
    @Param('tenantCode') tenantCode: string,
    @Param('uid') _uid: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { redirectTo } = await this.oidcInteraction.abort({
      tenantCode,
      req,
      res,
    });

    return res.json({ redirectTo });
  }

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
    const options = await this.userQuery.verifyMfa({
      tenantId: pending.tenantId,
      userId: pending.userId,
      method: 'webauthn',
      rpId: host.split(':')[0],
      expectedOrigin: `${req.protocol}://${host}`,
    });

    return res.json(options);
  }

  @Get(':uid/idp/:provider')
  async redirectToIdp(
    @Param('tenantCode') tenantCode: string,
    @Param('uid') uid: string,
    @Param('provider') providerName: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.oidcInteraction.getIdpRedirect({
      tenantCode,
      uid,
      providerName,
      req,
      tenant: this.getTenant(req),
    });
    if ('body' in result) {
      return res.status(result.status ?? 200).json(result.body);
    }

    return res.redirect(result.redirectTo);
  }

  @Get(':uid/idp/:provider/callback')
  async idpCallback(
    @Param('tenantCode') tenantCode: string,
    @Param('uid') uid: string,
    @Param('provider') providerName: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.oidcInteraction.handleIdpCallback({
      tenantCode,
      uid,
      providerName,
      req,
      res,
      tenant: this.getTenant(req),
    });
    if (result.redirectTo) {
      return res.redirect(result.redirectTo);
    }
  }

  @Get('saml/:provider/metadata')
  async samlMetadata(
    @Param('tenantCode') tenantCode: string,
    @Param('provider') providerName: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.oidcInteraction.getSamlMetadata({
      tenantCode,
      providerName,
      req,
      tenant: this.getTenant(req),
    });
    if ('contentType' in result) {
      return res.type(result.contentType).send(result.body);
    }

    return res.status(result.status ?? 200).json(result.body);
  }

  @Post('saml/:provider/callback')
  async samlCallback(
    @Param('tenantCode') tenantCode: string,
    @Param('provider') providerName: string,
    @Body() body: { SAMLResponse?: string; RelayState?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.oidcInteraction.handleSamlCallback({
      tenantCode,
      providerName,
      relayState: body.RelayState,
      samlResponse: body.SAMLResponse,
      req,
      res,
      tenant: this.getTenant(req),
    });
    if ('body' in result) {
      return res.status(result.status ?? 200).json(result.body);
    }

    if (result.redirectTo) {
      return res.redirect(result.redirectTo);
    }
  }

  private getTenant(req: Request): TenantContext | undefined {
    return (req as any).tenant as TenantContext | undefined;
  }
}
