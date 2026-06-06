import { Injectable } from '@nestjs/common';
import { EntityManager, ref } from '@mikro-orm/core';
import { ScopeRepository, type ScopeListQuery } from '@domain/repositories';
import { ScopeModel } from '@domain/models/scope';
import { ScopeOrmEntity } from '../mikro-orm/entities/scope';
import { TenantOrmEntity } from '../mikro-orm/entities/tenant';
import { ScopeMapper } from './mapper/scope.mapper';

@Injectable()
export class ScopeRepositoryImpl implements ScopeRepository {
  constructor(private readonly em: EntityManager) {}

  async findById(id: string): Promise<ScopeModel | null> {
    const entity = await this.em.findOne(
      ScopeOrmEntity,
      { id },
      { populate: ['tenant'] },
    );
    return entity ? ScopeMapper.toDomain(entity) : null;
  }

  async findByName(tenantId: string, name: string): Promise<ScopeModel | null> {
    const entity = await this.em.findOne(
      ScopeOrmEntity,
      { tenant: { id: tenantId }, name },
      { populate: ['tenant'] },
    );
    return entity ? ScopeMapper.toDomain(entity) : null;
  }

  async findByNames(tenantId: string, names: string[]): Promise<ScopeModel[]> {
    if (names.length === 0) return [];
    const entities = await this.em.find(
      ScopeOrmEntity,
      { tenant: { id: tenantId }, name: { $in: names } },
      { populate: ['tenant'] },
    );
    return entities.map(ScopeMapper.toDomain);
  }

  async list(
    query: ScopeListQuery,
  ): Promise<{ items: ScopeModel[]; total: number }> {
    const offset = (query.page - 1) * query.limit;
    const [entities, total] = await this.em.findAndCount(
      ScopeOrmEntity,
      { tenant: { id: query.tenantId } },
      {
        populate: ['tenant'],
        limit: query.limit,
        offset,
        orderBy: { name: 'asc' },
      },
    );
    return { items: entities.map(ScopeMapper.toDomain), total };
  }

  async listEnabledByTenantId(tenantId: string): Promise<ScopeModel[]> {
    const entities = await this.em.find(
      ScopeOrmEntity,
      { tenant: { id: tenantId }, enabled: true },
      { populate: ['tenant'], orderBy: { name: 'asc' } },
    );
    return entities.map(ScopeMapper.toDomain);
  }

  async save(scope: ScopeModel): Promise<ScopeModel> {
    if (scope.id) {
      const existing = await this.em.findOneOrFail(
        ScopeOrmEntity,
        { id: scope.id },
        { populate: ['tenant'] },
      );
      ScopeMapper.toOrm(scope, existing);
      await this.em.flush();
      return ScopeMapper.toDomain(existing);
    }

    const entity = ScopeMapper.toOrm(scope);
    entity.tenant = ref(this.em.getReference(TenantOrmEntity, scope.tenantId));
    await this.em.persist(entity).flush();
    return ScopeMapper.toDomain(entity);
  }

  async delete(id: string): Promise<void> {
    const entity = await this.em.findOneOrFail(ScopeOrmEntity, { id });
    await this.em.remove(entity).flush();
  }
}
