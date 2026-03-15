import { Injectable } from '@nestjs/common';
import { EntityManager, ref } from '@mikro-orm/core';
import { PermissionRepository, PermissionListQuery } from '@domain/repositories';
import { PermissionModel } from '@domain/models/permission';
import { PermissionOrmEntity } from '../mikro-orm/entities/permission';
import { TenantOrmEntity } from '../mikro-orm/entities/tenant';
import { PermissionMapper } from './permission.mapper';

@Injectable()
export class PermissionRepositoryImpl implements PermissionRepository {
  constructor(private readonly em: EntityManager) {}

  async findById(id: string): Promise<PermissionModel | null> {
    const entity = await this.em.findOne(
      PermissionOrmEntity,
      { id },
      { populate: ['tenant'] },
    );
    return entity ? PermissionMapper.toDomain(entity) : null;
  }

  async findByCode(tenantId: string, code: string): Promise<PermissionModel | null> {
    const entity = await this.em.findOne(
      PermissionOrmEntity,
      { tenant: { id: tenantId }, code },
      { populate: ['tenant'] },
    );
    return entity ? PermissionMapper.toDomain(entity) : null;
  }

  async list(
    query: PermissionListQuery,
  ): Promise<{ items: PermissionModel[]; total: number }> {
    const offset = (query.page - 1) * query.limit;
    const [entities, total] = await this.em.findAndCount(
      PermissionOrmEntity,
      { tenant: { id: query.tenantId } },
      { populate: ['tenant'], limit: query.limit, offset },
    );
    return { items: entities.map(PermissionMapper.toDomain), total };
  }

  async save(permission: PermissionModel): Promise<PermissionModel> {
    if (permission.id) {
      const existing = await this.em.findOneOrFail(
        PermissionOrmEntity,
        { id: permission.id },
        { populate: ['tenant'] },
      );
      PermissionMapper.toOrm(permission, existing);
      await this.em.flush();
      return PermissionMapper.toDomain(existing);
    } else {
      const entity = PermissionMapper.toOrm(permission);
      entity.tenant = ref(this.em.getReference(TenantOrmEntity, permission.tenantId));
      await this.em.persist(entity).flush();
      return PermissionMapper.toDomain(entity);
    }
  }

  async delete(id: string): Promise<void> {
    const entity = await this.em.findOneOrFail(PermissionOrmEntity, { id });
    await this.em.remove(entity).flush();
  }
}
