import { Injectable } from '@nestjs/common';
import { EntityManager, ref } from '@mikro-orm/core';
import { ConsentRepository, ConsentListQuery } from '@domain/repositories/consent.repository';
import { ConsentModel } from '@domain/models/consent';
import { ConsentOrmEntity } from '../mikro-orm/entities/consent';
import { TenantOrmEntity } from '../mikro-orm/entities/tenant';
import { UserOrmEntity } from '../mikro-orm/entities/user';
import { ClientOrmEntity } from '../mikro-orm/entities/client';
import { ConsentMapper } from './mapper/consent.mapper';

@Injectable()
export class ConsentRepositoryImpl implements ConsentRepository {
  constructor(private readonly em: EntityManager) {}

  async findByTenantUserClient(
    tenantId: string,
    userId: string,
    clientRefId: string,
  ): Promise<ConsentModel | null> {
    const entity = await this.em.findOne(
      ConsentOrmEntity,
      {
        tenant: { id: tenantId },
        user: { id: userId },
        client: { id: clientRefId },
      },
      { populate: ['tenant', 'user', 'client'] },
    );
    return entity ? ConsentMapper.toDomain(entity) : null;
  }

  async listAllByUser(
    tenantId: string,
    userId: string,
  ): Promise<ConsentModel[]> {
    const entities = await this.em.find(
      ConsentOrmEntity,
      {
        tenant: { id: tenantId },
        user: { id: userId },
        revokedAt: null,
      },
      { populate: ['tenant', 'user', 'client'] },
    );
    return entities.map(ConsentMapper.toDomain);
  }

  async listByUser(
    query: ConsentListQuery,
  ): Promise<{ items: ConsentModel[]; total: number }> {
    const offset = (query.page - 1) * query.limit;
    const [entities, total] = await this.em.findAndCount(
      ConsentOrmEntity,
      {
        tenant: { id: query.tenantId },
        user: { id: query.userId },
        revokedAt: null,
      },
      { populate: ['tenant', 'user', 'client'], limit: query.limit, offset },
    );
    return { items: entities.map(ConsentMapper.toDomain), total };
  }

  async save(consent: ConsentModel): Promise<ConsentModel> {
    if (consent.id) {
      const existing = await this.em.findOneOrFail(
        ConsentOrmEntity,
        { id: consent.id },
        { populate: ['tenant', 'user', 'client'] },
      );
      ConsentMapper.toOrm(consent, existing);
      await this.em.flush();
      return ConsentMapper.toDomain(existing);
    } else {
      const entity = ConsentMapper.toOrm(consent);
      entity.tenant = ref(this.em.getReference(TenantOrmEntity, consent.tenantId));
      entity.user = ref(this.em.getReference(UserOrmEntity, consent.userId));
      entity.client = ref(this.em.getReference(ClientOrmEntity, consent.clientRefId));
      await this.em.persist(entity).flush();
      return ConsentMapper.toDomain(entity);
    }
  }

  async delete(id: string): Promise<void> {
    const entity = await this.em.findOneOrFail(ConsentOrmEntity, { id });
    await this.em.remove(entity).flush();
  }
}
