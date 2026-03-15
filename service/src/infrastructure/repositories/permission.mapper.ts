import { PermissionModel } from '@domain/models/permission';
import { PermissionOrmEntity } from '../mikro-orm/entities/permission';

export class PermissionMapper {
  static toDomain(entity: PermissionOrmEntity): PermissionModel {
    const permission = new PermissionModel(
      {
        tenantId: entity.tenant.id,
        code: entity.code,
        resource: entity.resource ?? null,
        action: entity.action ?? null,
        description: entity.description ?? null,
      },
      entity.id,
    );
    permission.setPersistence(entity.id, entity.createdAt!, entity.updatedAt!);
    return permission;
  }

  static toOrm(
    domain: PermissionModel,
    existing?: PermissionOrmEntity,
  ): PermissionOrmEntity {
    const entity = existing ?? new PermissionOrmEntity();

    if (!existing) {
      entity.code = domain.code;
    }

    entity.resource = domain.resource ?? null;
    entity.action = domain.action ?? null;
    entity.description = domain.description ?? null;

    if (domain.id) {
      entity.id = domain.id;
    }

    return entity;
  }
}
