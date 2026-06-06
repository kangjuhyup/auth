import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Logger, LogLevel, logAtLevel } from '@kangjuhyup/rvlog';
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
  private readonly logger = new Logger(TenantMiddleware.name);

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
      this.logDecision(req, 'denied', 'missing_tenant_code');
      throw new BadRequestException('tenantCode is required');
    }

    const tenant = await this.tenantContext.findByCode(tenantCode);

    if (!tenant) {
      this.logDecision(req, 'denied', 'tenant_not_found', { tenantCode });
      throw new NotFoundException(`Tenant not found: ${tenantCode}`);
    }

    (req as any).tenant = tenant;
    this.logDecision(req, 'resolved', 'tenant_found', {
      tenantCode,
      tenantId: tenant.id,
    });
    next();
  }

  private logDecision(
    req: Request,
    decision: 'resolved' | 'denied',
    reason: string,
    details: { tenantCode?: string; tenantId?: string } = {},
  ): void {
    const method = req.method ?? 'HTTP';
    const path = req.path ?? req.url ?? 'unknown';
    const detailParts = [
      details.tenantCode ? `tenantCode=${details.tenantCode}` : undefined,
      details.tenantId ? `tenantId=${details.tenantId}` : undefined,
    ].filter(Boolean);
    const suffix = detailParts.length > 0 ? ` ${detailParts.join(' ')}` : '';
    logAtLevel(
      this.logger,
      LogLevel.DEBUG,
      `${method} ${path} ${decision} reason=${reason}${suffix}`,
    );
  }
}
