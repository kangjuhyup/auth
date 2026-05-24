import { Injectable, NestMiddleware } from '@nestjs/common';
import { ulid } from 'ulid';
import type { NextFunction, Request, Response } from 'express';

const CORRELATION_ID_HEADER = 'x-correlation-id';
const REQUEST_ID_HEADER = 'x-request-id';
const SAFE_CORRELATION_ID = /^[a-zA-Z0-9._:-]{1,128}$/;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId =
      pickSafeHeader(req.headers[CORRELATION_ID_HEADER]) ??
      pickSafeHeader(req.headers[REQUEST_ID_HEADER]) ??
      ulid();

    (req as any).correlationId = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    next();
  }
}

function pickSafeHeader(value: unknown): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== 'string') {
    return undefined;
  }
  const trimmed = candidate.trim();
  return SAFE_CORRELATION_ID.test(trimmed) ? trimmed : undefined;
}
