import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { InteractionCommandPort } from '@application/ports/interaction-command.port';
import type { TenantContext } from '@application/dto';
import {
  InteractionLoginDto,
  InteractionMfaDto,
  InteractionPasswordChangeDto,
  InteractionTotpConfirmationDto,
  SamlCallbackDto,
} from '@presentation/dto';
import { ApiProduces, ApiTags } from '@nestjs/swagger';
import {
  ApiOkSchema,
  ApiRedirectSchema,
  OpenApiResponseSchemas,
} from '@presentation/openapi-response';

const SPA_INDEX_PATH = resolve(
  __dirname,
  '../../../interaction-ui/dist/index.html',
);

@ApiTags('Interaction')
@Controller('t/:tenantCode/interaction')
export class InteractionController {
  private cachedSpaHtml: string | null = null;

  constructor(
    private readonly interactionCommand: InteractionCommandPort,
    private readonly config: ConfigService,
  ) {}

  @Get(':uid')
  @ApiProduces('text/html')
  @ApiOkSchema('Serve interaction UI', { type: 'string', format: 'html' })
  serveSpa(@Res() res: Response) {
    if (!existsSync(SPA_INDEX_PATH)) {
      return res.status(404).json({ error: 'Interaction UI not built' });
    }

    const shouldCache = this.shouldCacheSpaHtml();
    const spaHtml = shouldCache
      ? (this.cachedSpaHtml ??= readFileSync(SPA_INDEX_PATH, 'utf-8'))
      : readFileSync(SPA_INDEX_PATH, 'utf-8');

    if (!shouldCache) {
      res.setHeader('Cache-Control', 'no-store');
    }

    return res.type('html').send(spaHtml);
  }

  @Get(':uid/api/details')
  @ApiOkSchema(
    'Get interaction details',
    OpenApiResponseSchemas.interactionDetails,
  )
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
  @ApiOkSchema(
    'Submit interaction login',
    OpenApiResponseSchemas.interactionResponse,
  )
  async submitLogin(
    @Param('tenantCode') tenantCode: string,
    @Param('uid') uid: string,
    @Body() body: InteractionLoginDto,
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
  @ApiOkSchema(
    'Submit interaction MFA',
    OpenApiResponseSchemas.interactionResponse,
  )
  async submitMfa(
    @Param('tenantCode') tenantCode: string,
    @Param('uid') uid: string,
    @Body() body: InteractionMfaDto,
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
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      correlationId:
        (req as any).correlationId ??
        req.get('x-correlation-id') ??
        req.get('x-request-id'),
      req,
      res,
      rpId: host.split(':')[0],
      expectedOrigin: `${req.protocol}://${host}`,
    });
    return res.status(result.status ?? 200).json(result.body);
  }

  @Post(':uid/api/mfa/totp/enroll')
  @ApiOkSchema(
    'Begin interaction TOTP enrollment',
    OpenApiResponseSchemas.totpEnrollment,
  )
  async beginTotpEnrollment(
    @Param('tenantCode') tenantCode: string,
    @Param('uid') uid: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.interactionCommand.beginTotpEnrollment({
      tenantCode,
      uid,
      tenant: this.getTenant(req),
    });
    return res.status(result.status ?? 200).json(result.body);
  }

  @Post(':uid/api/mfa/totp/confirm')
  @ApiOkSchema(
    'Confirm interaction TOTP enrollment',
    OpenApiResponseSchemas.interactionResponse,
  )
  async confirmTotpEnrollment(
    @Param('tenantCode') tenantCode: string,
    @Param('uid') uid: string,
    @Body() body: InteractionTotpConfirmationDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.interactionCommand.confirmTotpEnrollment({
      tenantCode,
      uid,
      code: body.code,
      req,
      res,
      tenant: this.getTenant(req),
    });
    return res.status(result.status ?? 200).json(result.body);
  }

  @Post(':uid/api/password-change')
  @ApiOkSchema(
    'Submit required password change',
    OpenApiResponseSchemas.interactionResponse,
  )
  async submitPasswordChange(
    @Param('tenantCode') tenantCode: string,
    @Param('uid') uid: string,
    @Body() body: InteractionPasswordChangeDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.interactionCommand.submitPasswordChange({
      tenantCode,
      uid,
      currentPassword: body.currentPassword ?? '',
      newPassword: body.newPassword ?? '',
      req,
      res,
      tenant: this.getTenant(req),
    });
    return res.status(result.status ?? 200).json(result.body);
  }

  @Post(':uid/api/consent')
  @ApiOkSchema('Submit interaction consent', OpenApiResponseSchemas.redirectTo)
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
  @ApiOkSchema('Abort interaction', OpenApiResponseSchemas.redirectTo)
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
  @ApiOkSchema(
    'Get WebAuthn authentication options',
    OpenApiResponseSchemas.webauthnOptions,
  )
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
  @ApiRedirectSchema('Redirect to external identity provider')
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
  @ApiRedirectSchema('Handle external identity provider callback')
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
  @ApiProduces('application/samlmetadata+xml', 'application/json')
  @ApiOkSchema('Get SAML SP metadata', { type: 'string', format: 'xml' })
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
  @ApiRedirectSchema('Handle SAML identity provider callback')
  async samlCallback(
    @Param('tenantCode') tenantCode: string,
    @Param('provider') providerName: string,
    @Body() body: SamlCallbackDto,
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

  private shouldCacheSpaHtml(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }
}
