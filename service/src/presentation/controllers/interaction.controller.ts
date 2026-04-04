// service/src/presentation/controllers/interaction.controller.ts
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { OIDC_PROVIDER } from '@infrastructure/oidc-provider/oidc-provider.constants';
import { OidcProviderRegistry } from '@infrastructure/oidc-provider/oidc-provider.registry';
import { UserQueryPort } from '@application/queries/ports/user-query.port';
import { renderLoginView } from '@presentation/views/interaction-login.view';
import { renderConsentView } from '@presentation/views/interaction-consent.view';

@Controller('t/:tenantCode/interaction')
export class InteractionController {
  constructor(
    @Inject(OIDC_PROVIDER)
    private readonly registry: OidcProviderRegistry,
    private readonly userQuery: UserQueryPort,
  ) {}

  /**
   * OIDC 인터랙션 진입점.
   * - login prompt → 로그인 화면
   * - consent prompt → 동의 화면
   * - 세션이 이미 있고 login prompt 없는 경우 (select_account 등) → 에러
   */
  @Get(':uid')
  async showInteraction(
    @Param('tenantCode') tenantCode: string,
    @Param('uid') uid: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const provider = await this.registry.get(tenantCode);
    const details = await provider.interactionDetails(req as any, res as any);
    const { prompt, params } = details;
    const clientId = String(params.client_id ?? '');
    const error = (req.query.error as string) ?? '';

    if (prompt.name === 'login') {
      return res
        .type('html')
        .send(renderLoginView({ tenantCode, uid, clientId, error }));
    }

    if (prompt.name === 'consent') {
      const missingScopes =
        ((prompt.details as any).missingOIDCScope as string[] | undefined) ??
        [];

      // 동의할 스코프가 없으면 바로 자동 처리 (grant가 이미 있음)
      if (missingScopes.length === 0) {
        return this.autoGrantConsent(tenantCode, uid, details, provider, req, res);
      }

      return res
        .type('html')
        .send(renderConsentView({ tenantCode, uid, clientId, missingScopes }));
    }

    // 알 수 없는 prompt (select_account 등) — provider에 에러 반환
    return provider.interactionFinished(req as any, res as any, {
      error: 'interaction_required',
      error_description: `Unsupported prompt: ${prompt.name}`,
    });
  }

  @Post(':uid/login')
  async submitLogin(
    @Param('tenantCode') tenantCode: string,
    @Param('uid') uid: string,
    @Body() body: { username?: string; password?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tenant = (req as any).tenant as { id: string } | undefined;
    if (!tenant) {
      return res.redirect(
        `/t/${tenantCode}/interaction/${uid}?error=tenant_not_found`,
      );
    }

    const result = await this.userQuery.authenticate({
      tenantId: tenant.id,
      username: body.username ?? '',
      password: body.password ?? '',
    });

    if (!result) {
      return res.redirect(
        `/t/${tenantCode}/interaction/${uid}?error=invalid_credentials`,
      );
    }

    const provider = await this.registry.get(tenantCode);
    await provider.interactionFinished(req as any, res as any, {
      login: { accountId: result.userId },
    });
  }

  @Post(':uid/consent')
  async submitConsent(
    @Param('tenantCode') tenantCode: string,
    @Param('uid') uid: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const provider = await this.registry.get(tenantCode);
    const details = await provider.interactionDetails(req as any, res as any);
    return this.autoGrantConsent(tenantCode, uid, details, provider, req, res);
  }

  @Get(':uid/abort')
  async abortInteraction(
    @Param('tenantCode') _tenantCode: string,
    @Param('uid') _uid: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const provider = await this.registry.get(_tenantCode);
    await provider.interactionFinished(req as any, res as any, {
      error: 'access_denied',
      error_description: 'End-User aborted interaction',
    });
  }

  /* ─── Private helpers ─── */

  private async autoGrantConsent(
    _tenantCode: string,
    _uid: string,
    details: Awaited<
      ReturnType<
        Awaited<ReturnType<OidcProviderRegistry['get']>>['interactionDetails']
      >
    >,
    provider: Awaited<ReturnType<OidcProviderRegistry['get']>>,
    req: Request,
    res: Response,
  ) {
    const { prompt, params, session } = details;
    if (prompt.name !== 'consent' || !session) {
      return provider.interactionFinished(req as any, res as any, {
        error: 'invalid_request',
        error_description: 'No active consent interaction',
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

    const missingScope = (
      (prompt.details as any).missingOIDCScope as string[] | undefined
    ) ?? [];
    if (missingScope.length) {
      grant.addOIDCScope(missingScope.join(' '));
    }

    const grantId = await grant.save();
    await provider.interactionFinished(req as any, res as any, {
      consent: { grantId },
    });
  }
}
