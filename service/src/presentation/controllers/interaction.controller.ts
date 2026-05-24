import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { InteractionCommandPort } from '@application/ports/interaction-command.port';
import type { TenantContext } from '@application/dto';

const SPA_INDEX_PATH = resolve(
  __dirname,
  '../../../interaction-ui/dist/index.html',
);

@Controller('t/:tenantCode/interaction')
export class InteractionController {
  private cachedSpaHtml: string | null = null;

  constructor(private readonly interactionCommand: InteractionCommandPort) {}

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
    const details = await this.interactionCommand.getDetails({
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
    const result = await this.interactionCommand.submitLogin({
      tenantCode,
      uid,
      username: body.username ?? '',
      password: body.password ?? '',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      correlationId:
        (req as any).correlationId ??
        req.get('x-correlation-id') ??
        req.get('x-request-id'),
      req,
      res,
      tenant: this.getTenant(req),
    });
    return res.status(result.status ?? 200).json(result.body);
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
    const host = req.get('host') ?? 'localhost';
    const result = await this.interactionCommand.submitMfa({
      tenantCode,
      uid,
      method: body.method,
      code: body.code,
      webauthnResponse: body.webauthnResponse,
      req,
      res,
      rpId: host.split(':')[0],
      expectedOrigin: `${req.protocol}://${host}`,
    });
    return res.status(result.status ?? 200).json(result.body);
  }

  @Post(':uid/api/consent')
  async submitConsent(
    @Param('tenantCode') tenantCode: string,
    @Param('uid') _uid: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.interactionCommand.submitConsent({
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
    const { redirectTo } = await this.interactionCommand.abort({
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
    const host = req.get('host') ?? 'localhost';
    const result = await this.interactionCommand.getWebAuthnOptions({
      uid,
      rpId: host.split(':')[0],
      expectedOrigin: `${req.protocol}://${host}`,
    });
    return res.status(result.status ?? 200).json(result.body);
  }

  @Get(':uid/idp/:provider')
  async redirectToIdp(
    @Param('tenantCode') tenantCode: string,
    @Param('uid') uid: string,
    @Param('provider') providerName: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.interactionCommand.getIdpRedirect({
      tenantCode,
      uid,
      providerName,
      req,
      res,
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
    const result = await this.interactionCommand.handleIdpCallback({
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
    const result = await this.interactionCommand.getSamlMetadata({
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
    const result = await this.interactionCommand.handleSamlCallback({
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
