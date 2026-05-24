import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AdminSessionPort } from '@application/ports/admin-session.port';
import { resolveAdminSessionToken } from './admin-session-cookie';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly adminSession: AdminSessionPort) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const token = resolveAdminSessionToken(req);
    if (!token) return false;

    try {
      const session = await this.adminSession.getAdminSession(token);
      if (!session) {
        return false;
      }

      (req as any).adminSession = session;
      return true;
    } catch {
      return false;
    }
  }
}
