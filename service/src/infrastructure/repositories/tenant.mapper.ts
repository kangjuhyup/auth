import { Tenant } from '@domain/models';
import { TenantOrmEntity } from '../mikro-orm/entities';

export class TenantMapper {
  static toDomain(entity: TenantOrmEntity): Tenant {
    const tenant = new Tenant(
      { code: entity.code, name: entity.name },
      entity.id,
    );
    tenant.setPersistence(entity.id, entity.createdAt!, entity.updatedAt!);
    return tenant;
  }

  static toOrm(domain: Tenant, existing?: TenantOrmEntity): TenantOrmEntity {
    const entity = existing ?? new TenantOrmEntity();

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
