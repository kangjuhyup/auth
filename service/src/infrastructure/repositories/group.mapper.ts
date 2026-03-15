import { GroupModel } from '@domain/models/group';
import { GroupOrmEntity } from '../mikro-orm/entities/group';

export class GroupMapper {
  static toDomain(entity: GroupOrmEntity): GroupModel {
    const group = new GroupModel(
      {
        tenantId: entity.tenant.id,
        code: entity.code,
        name: entity.name,
        parentId: entity.parent ? entity.parent.id : null,
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
