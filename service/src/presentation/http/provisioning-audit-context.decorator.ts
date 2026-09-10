import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AuditContext } from '@application/dto';

function first(value: unknown): string | undefined {
  if (Array.isArray(value))
    return typeof value[0] === 'string' ? value[0] : undefined;
  return typeof value === 'string' ? value : undefined;
}

export const ProvisioningAuditContext = createParamDecorator(
  (_: unknown, context: ExecutionContext): AuditContext => {
    const request = context.switchToHttp().getRequest<Request>();
    return AuditContext.of({
      ipAddress: request.ip ?? null,
      userAgent: first(request.headers['user-agent']) ?? null,
      correlationId:
        ((request as any).correlationId as string | undefined) ??
        first(request.headers['x-correlation-id']) ??
        first(request.headers['x-request-id']) ??
        null,
    });
  },
);
