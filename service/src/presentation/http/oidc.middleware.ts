import {
  BadRequestException,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { Logger, LogLevel, logAtLevel } from '@kangjuhyup/rvlog';
import type { Request, Response } from 'express';
import { OidcInteractionPort } from '@application/ports/oidc-interaction.port';

@Injectable()
export class OidcDelegateMiddleware implements NestMiddleware {
  private readonly logger = new Logger(OidcDelegateMiddleware.name);

  constructor(private readonly oidcInteraction: OidcInteractionPort) {}

  async use(req: Request, res: Response) {
    const tenantCode = req.params.tenantCode;
    if (tenantCode === undefined) {
      this.logDecision(req, 'denied', 'missing_tenant_code');
      throw new BadRequestException('Tenant code is required');
    }
    if (Array.isArray(tenantCode)) {
      this.logDecision(req, 'denied', 'invalid_tenant_code');
      throw new BadRequestException('Tenant code is must be a string');
    }
    this.logDecision(req, 'delegated', 'provider_callback', { tenantCode });
    return this.oidcInteraction.delegateProviderCallback({
      tenantCode,
      req,
      res,
    });
  }

  private logDecision(
    req: Request,
    decision: 'delegated' | 'denied',
    reason: string,
    details: { tenantCode?: string } = {},
  ): void {
    const method = req.method ?? 'HTTP';
    const path = req.path ?? req.url ?? 'unknown';
    const suffix = details.tenantCode
      ? ` tenantCode=${details.tenantCode}`
      : '';
    logAtLevel(
      this.logger,
      LogLevel.DEBUG,
      `${method} ${path} ${decision} reason=${reason}${suffix}`,
    );
  }
}
