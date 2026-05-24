import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuditContext } from '@application/dto';

function pickFirst(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }

  return typeof value === 'string' ? value : undefined;
}

export const AdminAuditContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuditContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const adminSession = (request as any).adminSession as
      | { userId?: string; username?: string }
      | undefined;

    return {
      actorUserId: adminSession?.userId ?? null,
      actorUsername: adminSession?.username ?? null,
      ipAddress: request.ip ?? null,
      userAgent: pickFirst(request.headers['user-agent']) ?? null,
      correlationId:
        ((request as any).correlationId as string | undefined) ??
        pickFirst(request.headers['x-correlation-id']) ??
        pickFirst(request.headers['x-request-id']) ??
        null,
    };
  },
);
