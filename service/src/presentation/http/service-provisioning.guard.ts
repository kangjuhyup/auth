import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ServiceAccessError,
  ServiceAccessVerifierPort,
} from '@application/ports/service-access-verifier.port';

@Injectable()
export class ServiceProvisioningGuard implements CanActivate {
  constructor(private readonly verifier: ServiceAccessVerifierPort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;
    const tenantId = (request as any).tenant?.id as string | undefined;
    if (!tenantId || !authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }
    const bearerToken = authorization.slice('Bearer '.length).trim();
    if (!bearerToken) throw new UnauthorizedException();

    try {
      (request as any).servicePrincipal = await this.verifier.verify(
        tenantId,
        bearerToken,
      );
      return true;
    } catch (error) {
      if (
        error instanceof ServiceAccessError &&
        error.code === 'insufficient_scope'
      ) {
        throw new ForbiddenException('Insufficient service scope');
      }
      throw new UnauthorizedException();
    }
  }
}
