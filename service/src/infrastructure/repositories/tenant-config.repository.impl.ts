import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { TenantConfigRepository } from '@domain/repositories/tenant-config.repository';
import { TenantConfigModel } from '@domain/models/tenant-config';
import { TenantConfigOrmEntity } from '../mikro-orm/entities/tenant-config';
import { TenantOrmEntity } from '../mikro-orm/entities/tenant';
import { TenantConfigMapper } from './mapper/tenant-config.mapper';

@Injectable()
export class TenantConfigRepositoryImpl implements TenantConfigRepository {
  constructor(private readonly em: EntityManager) {}

  async findByTenantId(tenantId: string): Promise<TenantConfigModel | null> {
    const entity = await this.em.findOne(
      TenantConfigOrmEntity,
      { tenant: { id: tenantId } } as any,
      { populate: ['tenant'] },
    );
    return entity ? TenantConfigMapper.toDomain(entity) : null;
  }

  async save(config: TenantConfigModel): Promise<TenantConfigModel> {
    const existing = await this.em.findOne(
      TenantConfigOrmEntity,
      { tenant: { id: config.tenantId } } as any,
      { populate: ['tenant'] },
    );

    if (existing) {
      TenantConfigMapper.toOrm(config, existing);
      await this.em.flush();
      return TenantConfigMapper.toDomain(existing);
    }

    const tenantRef = this.em.getReference(TenantOrmEntity, config.tenantId);
    const entity = new TenantConfigOrmEntity();
    entity.tenant = tenantRef;
    TenantConfigMapper.toOrm(config, entity);
    await this.em.persist(entity).flush();
    return TenantConfigMapper.toDomain(entity);
  }
}
