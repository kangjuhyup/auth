import { ScopeModel } from '@domain/models/scope';
import { ScopeOrmEntity } from '../../mikro-orm/entities/scope';

export class ScopeMapper {
  static toDomain(entity: ScopeOrmEntity): ScopeModel {
    const scope = new ScopeModel(
      {
        tenantId: entity.tenant.id,
        name: entity.name,
        displayName: entity.displayName,
        description: entity.description ?? null,
        claimKeys: entity.claimKeys ?? [],
        enabled: entity.enabled,
        builtIn: entity.builtIn,
      },
      entity.id,
    );
    scope.setPersistence(entity.id, entity.createdAt!, entity.updatedAt!);
    return scope;
  }

  static toOrm(domain: ScopeModel, existing?: ScopeOrmEntity): ScopeOrmEntity {
    const entity = existing ?? new ScopeOrmEntity();

    if (!existing) {
      entity.name = domain.name;
      entity.builtIn = domain.builtIn;
    }

    entity.displayName = domain.displayName;
    entity.description = domain.description ?? null;
    entity.claimKeys = domain.claimKeys;
    entity.enabled = domain.enabled;

    if (domain.id) {
      entity.id = domain.id;
    }

    return entity;
  }
}
