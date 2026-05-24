import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

type RequestLogRecord = Readonly<{
  level: 'info';
  type: 'http_request';
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  tenantId: string | null;
  clientId: string | null;
  userId: string | null;
  correlationId: string | null;
}>;

@Injectable()
export class StructuredRequestLoggingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const startedAt = Date.now();

    res.on('finish', () => {
      const record: RequestLogRecord = {
        level: 'info',
        type: 'http_request',
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
        tenantId: stringOrNull((req as any).tenant?.id),
        clientId: stringOrNull((req as any).oidc?.client?.clientId),
        userId: stringOrNull(
          (req as any).adminSession?.userId ?? (req as any).user?.id,
        ),
        correlationId: stringOrNull((req as any).correlationId),
      };

      console.log(JSON.stringify(record));
    });

    next();
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
