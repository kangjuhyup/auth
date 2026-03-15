import { ClientModel } from '@domain/models/client';
import { ClientOrmEntity } from '../mikro-orm/entities/client';

export class ClientMapper {
  static toDomain(entity: ClientOrmEntity): ClientModel {
    const client = new ClientModel(
      {
        tenantId: entity.tenant.id,
        clientId: entity.clientId,
        name: entity.name,
        type: entity.type,
        enabled: entity.enabled,
        redirectUris: entity.redirectUris,
        grantTypes: entity.grantTypes,
        responseTypes: entity.responseTypes,
        tokenEndpointAuthMethod: entity.tokenEndpointAuthMethod,
        scope: entity.scope,
        postLogoutRedirectUris: entity.postLogoutRedirectUris,
      },
      entity.id,
    );
    client.setPersistence(entity.id, entity.createdAt!, entity.updatedAt!);
    return client;
  }

  static toOrm(domain: ClientModel, existing?: ClientOrmEntity): ClientOrmEntity {
    const entity = existing ?? new ClientOrmEntity();

    if (!existing) {
      entity.clientId = domain.clientId;
      entity.type = domain.type;
    }

    entity.name = domain.name;
    entity.enabled = domain.enabled;
    entity.redirectUris = domain.redirectUris;
    entity.grantTypes = domain.grantTypes;
    entity.responseTypes = domain.responseTypes;
    entity.tokenEndpointAuthMethod = domain.tokenEndpointAuthMethod;
    entity.scope = domain.scope;
    entity.postLogoutRedirectUris = domain.postLogoutRedirectUris;

    if (domain.id) {
      entity.id = domain.id;
    }

    return entity;
  }
}
