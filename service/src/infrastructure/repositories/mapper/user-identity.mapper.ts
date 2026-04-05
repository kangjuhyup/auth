import { UserIdentityModel } from '@domain/models/user-identity';
import { UserIdentityOrmEntity } from '../../mikro-orm/entities/user-identity';

export class UserIdentityMapper {
  static toDomain(entity: UserIdentityOrmEntity): UserIdentityModel {
    const model = new UserIdentityModel(
      {
        tenantId: entity.tenant.id,
        userId: entity.user.id,
        provider: entity.provider,
        providerSub: entity.providerSub,
        email: entity.email ?? null,
        profileJson: entity.profileJson ?? null,
        linkedAt: entity.linkedAt,
      },
      entity.id,
    );
    model.setPersistence(entity.id, entity.createdAt!, entity.updatedAt!);
    return model;
  }
}
