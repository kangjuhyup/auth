import { Injectable } from '@nestjs/common';
import type { TenantContext } from '@application/dto';
import { TenantContextPort } from '@application/ports/tenant-context.port';
import { TenantRepository } from '@domain/repositories';

@Injectable()
export class TenantContextAdapter extends TenantContextPort {
  constructor(private readonly tenantRepository: TenantRepository) {
    super();
  }

  async findByCode(code: string): Promise<TenantContext | null> {
    const tenant = await this.tenantRepository.findByCode(code);
    if (!tenant) {
      return null;
    }

    return {
      id: tenant.id,
      code: tenant.code,
      name: tenant.name,
    };
  }
}
