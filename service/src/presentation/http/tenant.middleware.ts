import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContextPort } from '@application/ports/tenant-context.port';

function pickFirst(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }

  return typeof value === 'string' ? value : undefined;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantContext: TenantContextPort) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const tenantCode =
      pickFirst(req.params['tenantCode']) ??
      pickFirst(req.query['tenantCode']) ??
      pickFirst(req.query['tenant_code']) ??
      pickFirst(
        (req.body as Record<string, unknown> | undefined)?.['tenantCode'],
      ) ??
      pickFirst(
        (req.body as Record<string, unknown> | undefined)?.['tenant_code'],
      ) ??
      pickFirst(req.headers['x-tenant-code']);

    if (!tenantCode) {
      throw new BadRequestException('tenantCode is required');
    }

    const tenant = await this.tenantContext.findByCode(tenantCode);

    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantCode}`);
    }

    (req as any).tenant = tenant;
    next();
  }
}
