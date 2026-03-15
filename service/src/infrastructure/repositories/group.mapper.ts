import { GroupModel } from '@domain/models/group';
import { GroupOrmEntity } from '../mikro-orm/entities/group';
import { wrap } from '@mikro-orm/core';

export class GroupMapper {
  static toDomain(entity: GroupOrmEntity): GroupModel {
    const group = new GroupModel(
      {
        tenantId: wrap(entity.tenant).unwrap().id,
        code: entity.code,
        name: entity.name,
        parentId: entity.parent ? wrap(entity.parent).unwrap().id : null,
      },
      entity.id,
    );
    group.setPersistence(entity.id, entity.createdAt!, entity.updatedAt!);
    return group;
  }

  static toOrm(domain: GroupModel, existing?: GroupOrmEntity): GroupOrmEntity {
    const entity = existing ?? new GroupOrmEntity();

    if (!existing) {
      entity.code = domain.code;
    }
    entity.name = domain.name;

    if (domain.id) {
      entity.id = domain.id;
    }

    return entity;
  }
}
