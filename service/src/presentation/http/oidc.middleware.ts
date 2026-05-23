import {
  BadRequestException,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { OidcInteractionPort } from '@application/ports/oidc-interaction.port';

@Injectable()
export class OidcDelegateMiddleware implements NestMiddleware {
  constructor(private readonly oidcInteraction: OidcInteractionPort) {}

  async use(req: Request, res: Response) {
    const tenantCode = req.params.tenantCode;
    if (tenantCode === undefined) {
      throw new BadRequestException('Tenant code is required');
    }
    if (Array.isArray(tenantCode)) {
      throw new BadRequestException('Tenant code is must be a string');
    }
    return this.oidcInteraction.delegateProviderCallback({
      tenantCode,
      req,
      res,
    });
  }
}
