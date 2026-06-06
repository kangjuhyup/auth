import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Logger, LogLevel, logAtLevel } from '@kangjuhyup/rvlog';
import type { Request } from 'express';
import { AdminSessionPort } from '@application/ports/admin-session.port';
import { resolveAdminSessionToken } from './admin-session-cookie';

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  constructor(private readonly adminSession: AdminSessionPort) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const token = resolveAdminSessionToken(req);
    if (!token) {
      this.logDecision(req, 'denied', 'missing_session_token');
      return false;
    }

    try {
      const session = await this.adminSession.getAdminSession(token);
      if (!session) {
        this.logDecision(req, 'denied', 'invalid_session');
        return false;
      }

      (req as any).adminSession = session;
      this.logDecision(req, 'allowed', 'valid_session', {
        userId: session.userId,
      });
      return true;
    } catch {
      this.logDecision(req, 'denied', 'session_verification_error');
      return false;
    }
  }

  private logDecision(
    req: Request,
    decision: 'allowed' | 'denied',
    reason: string,
    details: { userId?: string } = {},
  ): void {
    const method = req.method ?? 'HTTP';
    const path = req.originalUrl ?? req.url ?? req.path ?? 'unknown';
    const suffix = details.userId ? ` userId=${details.userId}` : '';
    logAtLevel(
      this.logger,
      LogLevel.DEBUG,
      `${method} ${path} ${decision} reason=${reason}${suffix}`,
    );
  }
}
