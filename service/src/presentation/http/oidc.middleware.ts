// service/src/infrastructure/oidc-provider/oidc-delegate.middleware.ts
import { OIDC_PROVIDER } from '@infrastructure/oidc-provider/oidc-provider.constants';
import { OidcProviderRegistry } from '@infrastructure/oidc-provider/oidc-provider.registry';
import {
  BadRequestException,
  Inject,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Injectable()
export class OidcDelegateMiddleware implements NestMiddleware {
  constructor(
    @Inject(OIDC_PROVIDER)
    private readonly registry: OidcProviderRegistry,
  ) {}

  use(req: Request, res: Response) {
    const tenantCode = req.params.tenantCode;
    if (tenantCode === undefined) {
      throw new BadRequestException('Tenant code is required');
    }
    if (Array.isArray(tenantCode)) {
      throw new BadRequestException('Tenant code is must be a string');
    }
    const provider = this.registry.get(tenantCode);

    const prefix = `/t/${tenantCode}/oidc`;
    if (req.url.startsWith(prefix)) {
      req.url = req.url.slice(prefix.length) || '/';
    }

    return provider.callback()(req as any, res as any);
  }
}
