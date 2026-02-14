import {
  Injectable,
  NestMiddleware,
  NotFoundException,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TENANT_REPOSITORY, TenantRepository } from '@domain/repositories';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const tenantCode = req.params.tenantCode;

    if (Array.isArray(tenantCode)) {
      throw new BadRequestException('Tenant code is must be a string');
    }

    if (!tenantCode) {
      throw new NotFoundException('Tenant code is required');
    }

    const tenant = await this.tenantRepository.findByCode(tenantCode);

    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantCode}`);
    }

    (req as any).tenant = tenant;
    next();
  }
}
