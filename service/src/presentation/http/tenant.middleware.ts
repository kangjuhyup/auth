import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantRepository } from '@domain/repositories';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantRepository: TenantRepository) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const raw = req.params['tenantCode'];
    const tenantCode = Array.isArray(raw) ? raw[0] : raw;

    if (!tenantCode) {
      throw new BadRequestException('tenantCode path parameter is required');
    }

    const tenant = await this.tenantRepository.findByCode(tenantCode);

    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantCode}`);
    }

    (req as any).tenant = tenant;
    next();
  }
}
