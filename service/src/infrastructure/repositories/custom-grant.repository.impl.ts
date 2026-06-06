import { Injectable } from '@nestjs/common';
import { EntityManager, ref } from '@mikro-orm/core';
import {
  CustomGrantRepository,
  type CustomGrantListQuery,
} from '@domain/repositories';
import { CustomGrantModel } from '@domain/models/custom-grant';
import { CustomGrantOrmEntity } from '../mikro-orm/entities/custom-grant';
import { TenantOrmEntity } from '../mikro-orm/entities/tenant';
import { CustomGrantMapper } from './mapper/custom-grant.mapper';

@Injectable()
export class CustomGrantRepositoryImpl implements CustomGrantRepository {
  constructor(private readonly em: EntityManager) {}

  async findById(id: string): Promise<CustomGrantModel | null> {
    const entity = await this.em.findOne(
      CustomGrantOrmEntity,
      { id },
      { populate: ['tenant'] },
    );
    return entity ? CustomGrantMapper.toDomain(entity) : null;
  }

  async findByGrantType(
    tenantId: string,
    grantType: string,
  ): Promise<CustomGrantModel | null> {
    const entity = await this.em.findOne(
      CustomGrantOrmEntity,
      { tenant: { id: tenantId }, grantType },
      { populate: ['tenant'] },
    );
    return entity ? CustomGrantMapper.toDomain(entity) : null;
  }

  async list(
    query: CustomGrantListQuery,
  ): Promise<{ items: CustomGrantModel[]; total: number }> {
    const offset = (query.page - 1) * query.limit;
    const [entities, total] = await this.em.findAndCount(
      CustomGrantOrmEntity,
      { tenant: { id: query.tenantId } },
      {
        populate: ['tenant'],
        limit: query.limit,
        offset,
        orderBy: { grantType: 'asc' },
      },
    );
    return { items: entities.map(CustomGrantMapper.toDomain), total };
  }

  async listByTenantId(tenantId: string): Promise<CustomGrantModel[]> {
    const entities = await this.em.find(
      CustomGrantOrmEntity,
      { tenant: { id: tenantId } },
      { populate: ['tenant'], orderBy: { grantType: 'asc' } },
    );
    return entities.map(CustomGrantMapper.toDomain);
  }

  async listEnabledByTenantId(tenantId: string): Promise<CustomGrantModel[]> {
    const entities = await this.em.find(
      CustomGrantOrmEntity,
      { tenant: { id: tenantId }, enabled: true },
      { populate: ['tenant'], orderBy: { grantType: 'asc' } },
    );
    return entities.map(CustomGrantMapper.toDomain);
  }

  async save(customGrant: CustomGrantModel): Promise<CustomGrantModel> {
    if (customGrant.id) {
      const existing = await this.em.findOneOrFail(
        CustomGrantOrmEntity,
        { id: customGrant.id },
        { populate: ['tenant'] },
      );
      CustomGrantMapper.toOrm(customGrant, existing);
      await this.em.flush();
      return CustomGrantMapper.toDomain(existing);
    }

    const entity = CustomGrantMapper.toOrm(customGrant);
    entity.tenant = ref(
      this.em.getReference(TenantOrmEntity, customGrant.tenantId),
    );
    await this.em.persist(entity).flush();
    return CustomGrantMapper.toDomain(entity);
  }

  async delete(id: string): Promise<void> {
    const entity = await this.em.findOneOrFail(CustomGrantOrmEntity, { id });
    await this.em.remove(entity).flush();
  }
}
