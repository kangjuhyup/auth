import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { TenantRepository } from '@domain/repositories';
import { Tenant } from '@domain/models';
import { TenantOrmEntity } from '../mikro-orm/entities';
import { TenantMapper } from './tenant.mapper';

@Injectable()
export class TenantRepositoryImpl implements TenantRepository {
  constructor(private readonly em: EntityManager) {}

  async findByCode(code: string): Promise<Tenant | null> {
    const entity = await this.em.findOne(TenantOrmEntity, { code });

    if (!entity) {
      return null;
    }

    return TenantMapper.toDomain(entity);
  }

  async findById(id: string): Promise<Tenant | null> {
    const entity = await this.em.findOne(TenantOrmEntity, { id });

    if (!entity) {
      return null;
    }

    return TenantMapper.toDomain(entity);
  }
}
