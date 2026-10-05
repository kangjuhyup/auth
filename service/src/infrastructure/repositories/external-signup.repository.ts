import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { ulid } from 'ulid';
import {
  ExternalSignupError,
  ExternalSignupRepositoryPort,
} from '@application/ports/external-signup.port';
import { UserModel } from '@domain/models/user';
import {
  UserOrmEntity,
  UserIdentityOrmEntity,
  TenantOrmEntity,
  ExternalSignupCompletionOrmEntity,
} from '../mikro-orm/entities';
@Injectable()
export class ExternalSignupRepository extends ExternalSignupRepositoryPort {
  constructor(private readonly em: EntityManager) {
    super();
  }
  async complete(
    params: Parameters<ExternalSignupRepositoryPort['complete']>[0],
  ): Promise<string> {
    // Unique identity + completion constraints arbitrate simultaneous callbacks/retries.
    // Retry once after a transaction rollback so the winner can be read safely.
    try {
      return await this.transaction(params);
    } catch (error) {
      if (error instanceof ExternalSignupError) throw error;
      return this.transaction(params);
    }
  }
  private async transaction(
    p: Parameters<ExternalSignupRepositoryPort['complete']>[0],
  ) {
    return this.em.fork().transactional(async (em) => {
      const replay = await em.findOne(ExternalSignupCompletionOrmEntity, {
        tenant: p.tenantId,
        consumerClientId: p.consumerClientId,
        keyHash: p.keyHash,
      });
      if (replay) {
        if (
          replay.provider !== p.provider ||
          replay.providerSub !== p.providerSub ||
          replay.clientId !== p.clientId
        )
          throw new ExternalSignupError('external_signup_conflict');
        const binding = await em.findOne(UserIdentityOrmEntity, {
          tenant: p.tenantId,
          provider: p.provider,
          providerSub: p.providerSub,
        });
        if (!binding || binding.user.id !== replay.user.id)
          throw new ExternalSignupError('external_signup_conflict');
        const user = await em.findOne(UserOrmEntity, {
          id: replay.user.id,
          tenant: p.tenantId,
          status: 'ACTIVE',
        });
        if (!user)
          throw new ExternalSignupError('external_signup_user_inactive');
        return user.id;
      }
      const identity = await em.findOne(UserIdentityOrmEntity, {
        tenant: p.tenantId,
        provider: p.provider,
        providerSub: p.providerSub,
      });
      let subject: string;
      if (identity) {
        const user = await em.findOne(UserOrmEntity, {
          id: identity.user.id,
          tenant: p.tenantId,
          status: 'ACTIVE',
        });
        if (!user)
          throw new ExternalSignupError('external_signup_user_inactive');
        subject = user.id;
      } else {
        const user = UserModel.createExternal({
          id: ulid(),
          tenantId: p.tenantId,
          provisionedByClientId: p.consumerClientId,
          provisioningKeyHash: p.keyHash,
        });
        const entity = em.create(UserOrmEntity, {
          id: user.id,
          tenant: em.getReference(TenantOrmEntity, p.tenantId),
          username: user.username,
          emailVerified: false,
          phoneVerified: false,
          status: user.status,
          mfaEnabled: false,
        });
        em.persist(entity);
        em.persist(
          em.create(UserIdentityOrmEntity, {
            tenant: em.getReference(TenantOrmEntity, p.tenantId),
            user: entity,
            provider: p.provider,
            providerSub: p.providerSub,
            profileJson: p.profile,
            linkedAt: new Date(),
          }),
        );
        subject = user.id;
      }
      em.persist(
        em.create(ExternalSignupCompletionOrmEntity, {
          id: ulid(),
          tenant: em.getReference(TenantOrmEntity, p.tenantId),
          user: em.getReference(UserOrmEntity, subject),
          consumerClientId: p.consumerClientId,
          clientId: p.clientId,
          keyHash: p.keyHash,
          provider: p.provider,
          providerSub: p.providerSub,
        }),
      );
      await em.flush();
      return subject;
    });
  }
}
