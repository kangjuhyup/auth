import { AccessVerifierPort } from '@application/ports/access-verifier.port';
import { Logger, LogLevel, logAtLevel } from '@kangjuhyup/rvlog';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class AccessGuard implements CanActivate {
  private readonly logger = new Logger(AccessGuard.name);

  constructor(private readonly verifier: AccessVerifierPort) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();

    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) {
      this.logDecision(req, 'denied', 'missing_bearer_token');
      return false;
    }

    const token = auth.slice('Bearer '.length).trim();

    // Tenant decorator가 req.tenant에 심어둔다면 그걸 우선 사용
    const tenantId =
      (req as any).tenant?.id ??
      (req.headers['x-tenant-id'] as string | undefined);

    if (!tenantId) {
      this.logDecision(req, 'denied', 'missing_tenant');
      return false;
    }

    try {
      const user = await this.verifier.verify(tenantId, token);
      (req as any).authUser = user;
      this.logDecision(req, 'allowed', 'valid_access_token', {
        tenantId,
        userId: (user as { userId?: string } | null)?.userId,
      });

      return true;
    } catch (error) {
      this.logDecision(req, 'denied', 'access_verification_error', {
        tenantId,
      });
      throw error;
    }
  }

  private logDecision(
    req: Request,
    decision: 'allowed' | 'denied',
    reason: string,
    details: { tenantId?: string; userId?: string } = {},
  ): void {
    const method = req.method ?? 'HTTP';
    const path = req.originalUrl ?? req.url ?? req.path ?? 'unknown';
    const detailParts = [
      details.tenantId ? `tenantId=${details.tenantId}` : undefined,
      details.userId ? `userId=${details.userId}` : undefined,
    ].filter(Boolean);
    const suffix = detailParts.length > 0 ? ` ${detailParts.join(' ')}` : '';
    logAtLevel(
      this.logger,
      LogLevel.DEBUG,
      `${method} ${path} ${decision} reason=${reason}${suffix}`,
    );
  }
}
