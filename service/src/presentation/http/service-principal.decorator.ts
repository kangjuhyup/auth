import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ServicePrincipal as Principal } from '@application/ports/service-access-verifier.port';

export const ServicePrincipal = createParamDecorator(
  (_: unknown, context: ExecutionContext): Principal =>
    context.switchToHttp().getRequest().servicePrincipal,
);
