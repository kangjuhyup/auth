import { Injectable } from '@nestjs/common';
import { EntityManager, ref } from '@mikro-orm/core';
import {
  IdentityProviderListQuery,
  IdentityProviderRepository,
} from '@domain/repositories';
import { IdentityProviderModel } from '@domain/models/identity-provider';
import { IdentityProviderOrmEntity } from '../mikro-orm/entities/indentity-provider';
import { TenantOrmEntity } from '../mikro-orm/entities/tenant';
import { IdentityProviderMapper } from './mapper/identity-provider.mapper';

@Injectable()
export class IdentityProviderRepositoryImpl
  implements IdentityProviderRepository
{
  constructor(private readonly em: EntityManager) {}

  async findByTenantAndProvider(
    tenantId: string,
    provider: string,
  ): Promise<IdentityProviderModel | null> {
    const entity = await this.em.findOne(
      IdentityProviderOrmEntity,
      { tenant: { id: tenantId }, provider: provider as any },
      { populate: ['tenant'] },
    );
    return entity ? IdentityProviderMapper.toDomain(entity) : null;
  }

  async listEnabledByTenant(
    tenantId: string,
  ): Promise<IdentityProviderModel[]> {
    const entities = await this.em.find(
      IdentityProviderOrmEntity,
      { tenant: { id: tenantId }, enabled: true },
      { populate: ['tenant'] },
    );
    return entities.map(IdentityProviderMapper.toDomain);
  }

  async listByTenant(
    query: IdentityProviderListQuery,
  ): Promise<{ items: IdentityProviderModel[]; total: number }> {
    const offset = (query.page - 1) * query.limit;
    const [entities, total] = await this.em.findAndCount(
      IdentityProviderOrmEntity,
      { tenant: { id: query.tenantId } },
      {
        populate: ['tenant'],
        limit: query.limit,
        offset,
        orderBy: { provider: 'asc' },
      },
    );
    return { items: entities.map(IdentityProviderMapper.toDomain), total };
  }

  async findByIdForTenant(
    tenantId: string,
    id: string,
  ): Promise<IdentityProviderModel | null> {
    const entity = await this.em.findOne(
      IdentityProviderOrmEntity,
      { id, tenant: { id: tenantId } },
      { populate: ['tenant'] },
    );
    return entity ? IdentityProviderMapper.toDomain(entity) : null;
  }

  async save(model: IdentityProviderModel): Promise<IdentityProviderModel> {
    if (model.id) {
      const existing = await this.em.findOneOrFail(
        IdentityProviderOrmEntity,
        { id: model.id },
        { populate: ['tenant'] },
      );
      IdentityProviderMapper.toOrm(model, existing);
      await this.em.flush();
      return IdentityProviderMapper.toDomain(existing);
    }
    const entity = IdentityProviderMapper.toOrm(model);
    entity.tenant = ref(
      this.em.getReference(TenantOrmEntity, model.tenantId),
    );
    await this.em.persist(entity).flush();
    return IdentityProviderMapper.toDomain(entity);
  }

  async delete(id: string): Promise<void> {
    const entity = await this.em.findOneOrFail(IdentityProviderOrmEntity, {
      id,
    });
    await this.em.remove(entity).flush();
  }
}
