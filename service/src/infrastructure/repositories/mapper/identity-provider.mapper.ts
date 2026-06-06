import { IdentityProviderModel } from '@domain/models/identity-provider';
import { IdentityProviderOrmEntity } from '../../mikro-orm/entities/identity-provider';

export class IdentityProviderMapper {
  static toDomain(entity: IdentityProviderOrmEntity): IdentityProviderModel {
    const model = new IdentityProviderModel(
      {
        tenantId: entity.tenant.id,
        provider: entity.provider,
        protocol: entity.protocol ?? 'oauth2',
        displayName: entity.displayName,
        clientId: entity.clientId,
        clientSecret: entity.clientSecret ?? null,
        redirectUri: entity.redirectUri,
        enabled: entity.enabled,
        oauthConfig: entity.oauthConfig ?? null,
        samlConfig: entity.samlConfig ?? null,
      },
      entity.id,
    );
    model.setPersistence(entity.id, entity.createdAt!, entity.updatedAt!);
    return model;
  }

  static toOrm(
    model: IdentityProviderModel,
    existing?: IdentityProviderOrmEntity,
  ): IdentityProviderOrmEntity {
    if (existing) {
      existing.protocol = model.protocol;
      existing.displayName = model.displayName;
      existing.clientId = model.clientId;
      existing.clientSecret = model.clientSecret ?? undefined;
      existing.redirectUri = model.redirectUri;
      existing.enabled = model.enabled;
      existing.oauthConfig = model.oauthConfig ?? undefined;
      existing.samlConfig = model.samlConfig ?? undefined;
      return existing;
    }
    const entity = new IdentityProviderOrmEntity();
    entity.provider = model.provider;
    entity.protocol = model.protocol;
    entity.displayName = model.displayName;
    entity.clientId = model.clientId;
    entity.clientSecret = model.clientSecret ?? undefined;
    entity.redirectUri = model.redirectUri;
    entity.enabled = model.enabled;
    entity.oauthConfig = model.oauthConfig ?? undefined;
    entity.samlConfig = model.samlConfig ?? undefined;
    return entity;
  }
}
