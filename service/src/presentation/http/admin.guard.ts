import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

export interface AdminPayload {
  username: string;
  exp: number;
}

export function signAdminToken(username: string, secret: string, ttlMs = 86_400_000): string {
  const payload: AdminPayload = { username, exp: Date.now() + ttlMs };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const auth = req.headers['authorization'];
    if (!auth?.startsWith('Bearer ')) return false;
    return this.verify(auth.slice(7).trim());
  }

  private verify(token: string): boolean {
    try {
      const secret = this.config.getOrThrow<string>('ADMIN_JWT_SECRET');
      const dot = token.indexOf('.');
      if (dot < 0) return false;

      const payloadB64 = token.slice(0, dot);
      const sigB64 = token.slice(dot + 1);

      const expectedSig = createHmac('sha256', secret).update(payloadB64).digest('base64url');

      if (
        sigB64.length !== expectedSig.length ||
        !timingSafeEqual(Buffer.from(sigB64), Buffer.from(expectedSig))
      ) {
        return false;
      }

      const payload: AdminPayload = JSON.parse(
        Buffer.from(payloadB64, 'base64url').toString(),
      );
      return Date.now() < payload.exp;
    } catch {
      return false;
    }
  }
}
