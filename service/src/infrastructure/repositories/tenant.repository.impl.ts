import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { TenantRepository, TenantListQuery } from '@domain/repositories';
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

  async list(query: TenantListQuery): Promise<{ items: Tenant[]; total: number }> {
    const offset = (query.page - 1) * query.limit;
    const [entities, total] = await this.em.findAndCount(
      TenantOrmEntity,
      {},
      { limit: query.limit, offset },
    );
    return { items: entities.map(TenantMapper.toDomain), total };
  }

  async save(tenant: Tenant): Promise<Tenant> {
    if (tenant.id) {
      const existing = await this.em.findOneOrFail(TenantOrmEntity, {
        id: tenant.id,
      });
      TenantMapper.toOrm(tenant, existing);
      await this.em.flush();
      return TenantMapper.toDomain(existing);
    } else {
      const entity = TenantMapper.toOrm(tenant);
      await this.em.persist(entity).flush();
      return TenantMapper.toDomain(entity);
    }
  }

  async delete(id: string): Promise<void> {
    const entity = await this.em.findOneOrFail(TenantOrmEntity, { id });
    await this.em.remove(entity).flush();
  }
}
