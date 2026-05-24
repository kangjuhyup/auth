import { Injectable, NestMiddleware } from '@nestjs/common';
import { Logger, LogLevel, logAtLevel } from '@kangjuhyup/rvlog';
import { ulid } from 'ulid';
import type { NextFunction, Request, Response } from 'express';

const CORRELATION_ID_HEADER = 'x-correlation-id';
const REQUEST_ID_HEADER = 'x-request-id';
const SAFE_CORRELATION_ID = /^[a-zA-Z0-9._:-]{1,128}$/;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CorrelationIdMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    const resolved = resolveCorrelationId(req, res);
    const correlationId = resolved.value;

    (req as any).correlationId = correlationId;
    req.headers[CORRELATION_ID_HEADER] = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    this.logSelected(req, resolved.source);

    next();
  }

  private logSelected(req: Request, source: CorrelationIdSource): void {
    const method = req.method ?? 'HTTP';
    const path = req.path ?? req.url ?? 'unknown';
    logAtLevel(
      this.logger,
      LogLevel.DEBUG,
      `${method} ${path} selected source=${source}`,
    );
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

type CorrelationIdSource =
  | 'request_correlation_header'
  | 'response_correlation_header'
  | 'request_id_header'
  | 'generated';

function resolveCorrelationId(
  req: Request,
  res: Response,
): { value: string; source: CorrelationIdSource } {
  const requestCorrelationId = pickSafeHeader(
    req.headers[CORRELATION_ID_HEADER],
  );
  if (requestCorrelationId) {
    return {
      value: requestCorrelationId,
      source: 'request_correlation_header',
    };
  }

  const responseCorrelationId = pickSafeHeader(
    res.getHeader(CORRELATION_ID_HEADER),
  );
  if (responseCorrelationId) {
    return {
      value: responseCorrelationId,
      source: 'response_correlation_header',
    };
  }

  const requestId = pickSafeHeader(req.headers[REQUEST_ID_HEADER]);
  if (requestId) {
    return { value: requestId, source: 'request_id_header' };
  }

  return { value: ulid(), source: 'generated' };
}
