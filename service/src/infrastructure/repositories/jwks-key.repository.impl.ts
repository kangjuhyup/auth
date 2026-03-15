import { Injectable } from '@nestjs/common';
import { EntityManager, ref } from '@mikro-orm/core';
import { JwksKeyRepository } from '@domain/repositories/jwks-key.repository';
import { JwksKeyModel } from '@domain/models/jwks-key';
import { JwksKeyOrmEntity } from '../mikro-orm/entities/jwks-key';
import { TenantOrmEntity } from '../mikro-orm/entities/tenant';
import { JwksKeyMapper } from './mapper/jwks-key.mapper';

@Injectable()
export class JwksKeyRepositoryImpl implements JwksKeyRepository {
  constructor(private readonly em: EntityManager) {}

  async findActiveByTenantId(tenantId: string): Promise<JwksKeyModel[]> {
    const entities = await this.em.find(
      JwksKeyOrmEntity,
      { tenant: { id: tenantId }, status: 'active' } as any,
      { populate: ['tenant'] },
    );
    return entities.map(JwksKeyMapper.toDomain);
  }

  async save(key: JwksKeyModel): Promise<void> {
    const existing = await this.em.findOne(JwksKeyOrmEntity, { kid: key.kid });

    if (existing) {
      JwksKeyMapper.toOrm(key, existing);
      await this.em.flush();
      return;
    }

    const entity = new JwksKeyOrmEntity();
    entity.kid = key.kid;
    entity.tenant = ref(this.em.getReference(TenantOrmEntity, key.tenantId));
    entity.createdAt = key.createdAt;
    JwksKeyMapper.toOrm(key, entity);
    await this.em.persist(entity).flush();
  }

  async saveMany(keys: JwksKeyModel[]): Promise<void> {
    for (const key of keys) {
      const existing = await this.em.findOne(JwksKeyOrmEntity, {
        kid: key.kid,
      });

      if (existing) {
        JwksKeyMapper.toOrm(key, existing);
      } else {
        const entity = new JwksKeyOrmEntity();
        entity.kid = key.kid;
        entity.tenant = ref(
          this.em.getReference(TenantOrmEntity, key.tenantId),
        );
        entity.createdAt = key.createdAt;
        JwksKeyMapper.toOrm(key, entity);
        this.em.persist(entity);
      }
    }
    await this.em.flush();
  }
}
