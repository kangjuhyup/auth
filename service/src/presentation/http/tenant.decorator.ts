import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantContext } from './tenant.interface';

export const Tenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenant;
  },
);
