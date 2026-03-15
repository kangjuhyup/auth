import { UserModel } from '@domain/models/user';
import { UserCredentialModel } from '@domain/models/user-credential';
import { UserOrmEntity } from '../../mikro-orm/entities/user';
import { UserCredentialOrmEntity } from '../../mikro-orm/entities/user-credential';

export class UserMapper {
  static toDomain(
    entity: UserOrmEntity,
    activeCredential?: UserCredentialOrmEntity,
  ): UserModel {
    const credential = activeCredential
      ? UserMapper.credentialToDomain(activeCredential)
      : undefined;

    return UserModel.of({
      id: entity.id,
      tenantId: entity.tenant.id,
      username: entity.username,
      email: entity.email ?? null,
      emailVerified: entity.emailVerified,
      phone: entity.phone ?? null,
      phoneVerified: entity.phoneVerified,
      status: entity.status,
      passwordCredential: credential,
    }).setPersistence(
      entity.id,
      entity.createdAt ?? new Date(),
      entity.updatedAt ?? new Date(),
    );
  }

  static credentialToDomain(
    entity: UserCredentialOrmEntity,
  ): UserCredentialModel {
    return UserCredentialModel.password({
      secretHash: entity.secretHash,
      hashAlg: entity.hashAlg ?? '',
      hashParams: entity.hashParams ?? null,
      hashVersion: entity.hashVersion ?? null,
    });
  }
}
