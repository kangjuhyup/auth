import { Injectable } from '@nestjs/common';
import { EntityManager, ref } from '@mikro-orm/core';
import { GroupRepository, GroupListQuery } from '@domain/repositories';
import { GroupModel } from '@domain/models/group';
import { GroupOrmEntity } from '../mikro-orm/entities/group';
import { TenantOrmEntity } from '../mikro-orm/entities/tenant';
import { GroupMapper } from './mapper/group.mapper';

@Injectable()
export class GroupRepositoryImpl implements GroupRepository {
  constructor(private readonly em: EntityManager) {}

  async findById(id: string): Promise<GroupModel | null> {
    const entity = await this.em.findOne(
      GroupOrmEntity,
      { id },
      { populate: ['tenant', 'parent'] },
    );
    return entity ? GroupMapper.toDomain(entity) : null;
  }

  async findByCode(tenantId: string, code: string): Promise<GroupModel | null> {
    const entity = await this.em.findOne(
      GroupOrmEntity,
      { tenant: { id: tenantId }, code },
      { populate: ['tenant', 'parent'] },
    );
    return entity ? GroupMapper.toDomain(entity) : null;
  }

  async list(
    query: GroupListQuery,
  ): Promise<{ items: GroupModel[]; total: number }> {
    const offset = (query.page - 1) * query.limit;
    const [entities, total] = await this.em.findAndCount(
      GroupOrmEntity,
      { tenant: { id: query.tenantId } },
      { populate: ['tenant', 'parent'], limit: query.limit, offset },
    );
    return { items: entities.map(GroupMapper.toDomain), total };
  }

  async save(group: GroupModel): Promise<GroupModel> {
    if (group.id) {
      const existing = await this.em.findOneOrFail(
        GroupOrmEntity,
        { id: group.id },
        { populate: ['tenant', 'parent'] },
      );
      GroupMapper.toOrm(group, existing);

      if (group.parentId !== undefined) {
        existing.parent = group.parentId
          ? ref(this.em.getReference(GroupOrmEntity, group.parentId))
          : null;
      }

      await this.em.flush();
      return GroupMapper.toDomain(existing);
    } else {
      const entity = GroupMapper.toOrm(group);
      entity.tenant = ref(
        this.em.getReference(TenantOrmEntity, group.tenantId),
      );

      if (group.parentId) {
        entity.parent = ref(
          this.em.getReference(GroupOrmEntity, group.parentId),
        );
      }

      await this.em.persist(entity).flush();
      return GroupMapper.toDomain(entity);
    }
  }

  async delete(id: string): Promise<void> {
    const entity = await this.em.findOneOrFail(GroupOrmEntity, { id });
    await this.em.remove(entity).flush();
  }
}
