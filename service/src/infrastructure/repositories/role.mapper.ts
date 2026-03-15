import { RoleModel } from '@domain/models/role';
import { RoleOrmEntity } from '../mikro-orm/entities/role';

export class RoleMapper {
  static toDomain(entity: RoleOrmEntity): RoleModel {
    const role = new RoleModel(
      {
        tenantId: entity.tenant.id,
        code: entity.code,
        name: entity.name,
        description: entity.description ?? null,
      },
      entity.id,
    );
    role.setPersistence(entity.id, entity.createdAt!, entity.updatedAt!);
    return role;
  }

  static toOrm(domain: RoleModel, existing?: RoleOrmEntity): RoleOrmEntity {
    const entity = existing ?? new RoleOrmEntity();

    if (!existing) {
      entity.code = domain.code;
    }
    entity.name = domain.name;
    entity.description = domain.description ?? null;

    if (domain.id) {
      entity.id = domain.id;
    }

    return entity;
  }
}
