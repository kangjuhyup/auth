import { Injectable } from '@nestjs/common';
import { EntityManager, ref } from '@mikro-orm/core';
import { RoleRepository, RoleListQuery } from '@domain/repositories';
import { RoleModel } from '@domain/models/role';
import { RoleOrmEntity } from '../mikro-orm/entities/role';
import { TenantOrmEntity } from '../mikro-orm/entities/tenant';
import { RoleMapper } from './mapper/role.mapper';

@Injectable()
export class RoleRepositoryImpl implements RoleRepository {
  constructor(private readonly em: EntityManager) {}

  async findById(id: string): Promise<RoleModel | null> {
    const entity = await this.em.findOne(
      RoleOrmEntity,
      { id },
      { populate: ['tenant'] },
    );
    return entity ? RoleMapper.toDomain(entity) : null;
  }

  async findByCode(tenantId: string, code: string): Promise<RoleModel | null> {
    const entity = await this.em.findOne(
      RoleOrmEntity,
      { tenant: { id: tenantId }, code },
      { populate: ['tenant'] },
    );
    return entity ? RoleMapper.toDomain(entity) : null;
  }

  async list(
    query: RoleListQuery,
  ): Promise<{ items: RoleModel[]; total: number }> {
    const offset = (query.page - 1) * query.limit;
    const [entities, total] = await this.em.findAndCount(
      RoleOrmEntity,
      { tenant: { id: query.tenantId } },
      { populate: ['tenant'], limit: query.limit, offset },
    );
    return { items: entities.map(RoleMapper.toDomain), total };
  }

  async save(role: RoleModel): Promise<RoleModel> {
    if (role.id) {
      const existing = await this.em.findOneOrFail(
        RoleOrmEntity,
        { id: role.id },
        { populate: ['tenant'] },
      );
      RoleMapper.toOrm(role, existing);
      await this.em.flush();
      return RoleMapper.toDomain(existing);
    } else {
      const entity = RoleMapper.toOrm(role);
      entity.tenant = ref(this.em.getReference(TenantOrmEntity, role.tenantId));
      await this.em.persist(entity).flush();
      return RoleMapper.toDomain(entity);
    }
  }

  async delete(id: string): Promise<void> {
    const entity = await this.em.findOneOrFail(RoleOrmEntity, { id });
    await this.em.remove(entity).flush();
  }
}
