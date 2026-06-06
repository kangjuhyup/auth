import { CustomGrantModel } from '@domain/models/custom-grant';
import { CustomGrantOrmEntity } from '../../mikro-orm/entities/custom-grant';

export class CustomGrantMapper {
  static toDomain(entity: CustomGrantOrmEntity): CustomGrantModel {
    const grant = new CustomGrantModel(
      {
        tenantId: entity.tenant.id,
        grantType: entity.grantType,
        displayName: entity.displayName,
        description: entity.description ?? null,
        enabled: entity.enabled,
        allowedClientTypes: entity.allowedClientTypes ?? [],
        allowedApplicationTypes: entity.allowedApplicationTypes ?? [],
        requiresClientAuthentication: entity.requiresClientAuthentication,
        requiresGrantTypes: entity.requiresGrantTypes ?? [],
        builtIn: entity.builtIn,
      },
      entity.id,
    );
    grant.setPersistence(entity.id, entity.createdAt!, entity.updatedAt!);
    return grant;
  }

  static toOrm(
    domain: CustomGrantModel,
    existing?: CustomGrantOrmEntity,
  ): CustomGrantOrmEntity {
    const entity = existing ?? new CustomGrantOrmEntity();

    if (!existing) {
      entity.grantType = domain.grantType;
      entity.builtIn = domain.builtIn;
    }

    entity.displayName = domain.displayName;
    entity.description = domain.description ?? null;
    entity.enabled = domain.enabled;
    entity.allowedClientTypes = domain.allowedClientTypes;
    entity.allowedApplicationTypes = domain.allowedApplicationTypes;
    entity.requiresClientAuthentication = domain.requiresClientAuthentication;
    entity.requiresGrantTypes = domain.requiresGrantTypes;

    if (domain.id) {
      entity.id = domain.id;
    }

    return entity;
  }
}
