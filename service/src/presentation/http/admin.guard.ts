import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AdminSessionPort } from '@application/ports/admin-session.port';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly adminSession: AdminSessionPort) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const auth = req.headers['authorization'];
    if (!auth?.startsWith('Bearer ')) return false;

    const token = auth.slice(7).trim();
    if (!token) return false;

    try {
      return await this.adminSession.verifyAdminToken(token);
    } catch {
      return false;
    }
  }
}
