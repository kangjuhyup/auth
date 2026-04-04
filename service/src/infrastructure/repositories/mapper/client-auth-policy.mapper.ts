import { ClientAuthPolicyModel } from '@domain/models/client-auth-policy';
import type { AuthMethod, MfaMethod } from '@domain/models/client-auth-policy';
import { ClientAuthPolicyOrmEntity } from '../../mikro-orm/entities/client-auth-policy';

export class ClientAuthPolicyMapper {
  static toDomain(entity: ClientAuthPolicyOrmEntity): ClientAuthPolicyModel {
    const policy = new ClientAuthPolicyModel(
      {
        tenantId: entity.tenant.id,
        clientRefId: entity.client.id,
        allowedAuthMethods: entity.allowedAuthMethods as AuthMethod[],
        defaultAcr: entity.defaultAcr,
        mfaRequired: entity.mfaRequired,
        allowedMfaMethods: entity.allowedMfaMethods as MfaMethod[],
        maxSessionDurationSec: entity.maxSessionDurationSec ?? null,
        consentRequired: entity.consentRequired,
        requireAuthTime: entity.requireAuthTime,
      },
      entity.id,
    );
    policy.setPersistence(entity.id, entity.createdAt!, entity.updatedAt!);
    return policy;
  }

  static toOrm(
    domain: ClientAuthPolicyModel,
    existing?: ClientAuthPolicyOrmEntity,
  ): ClientAuthPolicyOrmEntity {
    const entity = existing ?? new ClientAuthPolicyOrmEntity();

    entity.allowedAuthMethods = domain.allowedAuthMethods;
    entity.defaultAcr = domain.defaultAcr;
    entity.mfaRequired = domain.mfaRequired;
    entity.allowedMfaMethods = domain.allowedMfaMethods;
    entity.maxSessionDurationSec = domain.maxSessionDurationSec;
    entity.consentRequired = domain.consentRequired;
    entity.requireAuthTime = domain.requireAuthTime;

    if (domain.id) {
      entity.id = domain.id;
    }

    return entity;
  }
}
