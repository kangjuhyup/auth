import { ConsentModel } from '@domain/models/consent';
import { ConsentOrmEntity } from '../../mikro-orm/entities/consent';

export class ConsentMapper {
  static toDomain(entity: ConsentOrmEntity): ConsentModel {
    const client = entity.client.isInitialized()
      ? entity.client.unwrap()
      : undefined;

    const consent = new ConsentModel(
      {
        tenantId: entity.tenant.id,
        userId: entity.user.id,
        clientRefId: entity.client.id,
        clientId: client?.clientId,
        clientName: client?.name,
        grantedScopes: entity.grantedScopes,
        grantedAt: entity.grantedAt,
        revokedAt: entity.revokedAt ?? null,
      },
      entity.id,
    );
    return consent;
  }

  static toOrm(
    domain: ConsentModel,
    existing?: ConsentOrmEntity,
  ): ConsentOrmEntity {
    const entity = existing ?? new ConsentOrmEntity();
    entity.grantedScopes = domain.grantedScopes;
    entity.grantedAt = domain.grantedAt;
    entity.revokedAt = domain.revokedAt ?? null;

    if (domain.id) {
      entity.id = domain.id;
    }

    return entity;
  }
}
