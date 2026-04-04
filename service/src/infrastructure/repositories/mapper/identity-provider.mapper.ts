import { IdentityProviderModel } from '@domain/models/identity-provider';
import type { IdpProvider } from '@domain/models/identity-provider';
import { IdentityProviderOrmEntity } from '../../mikro-orm/entities/indentity-provider';

export class IdentityProviderMapper {
  static toDomain(entity: IdentityProviderOrmEntity): IdentityProviderModel {
    const model = new IdentityProviderModel(
      {
        tenantId: entity.tenant.id,
        provider: entity.provider as IdpProvider,
        displayName: entity.displayName,
        clientId: entity.clientId,
        clientSecret: entity.clientSecret ?? null,
        redirectUri: entity.redirectUri,
        enabled: entity.enabled,
      },
      entity.id,
    );
    model.setPersistence(entity.id, entity.createdAt!, entity.updatedAt!);
    return model;
  }
}
