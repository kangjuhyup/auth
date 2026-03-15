import { AccessVerifierPort } from '@application/ports/access-verifier.port';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private readonly verifier: AccessVerifierPort) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();

    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) return false;

    const token = auth.slice('Bearer '.length).trim();

    // Tenant decorator가 req.tenant에 심어둔다면 그걸 우선 사용
    const tenantId =
      (req as any).tenant?.id ??
      (req.headers['x-tenant-id'] as string | undefined);

    if (!tenantId) return false;

    const user = await this.verifier.verify(tenantId, token);
    (req as any).authUser = user;

    return true;
  }
}
