import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import type { DomainEvent } from '@domain/events';
import type { DomainEventHandler } from '@application/command/ports/domain-event-handler';
import { UserOrmEntity } from '../../mikro-orm/entities/user';
import { TenantOrmEntity } from '../../mikro-orm/entities/tenant';
import { UserCreatedEvent } from '@domain/events/user/user-created.event';
import { UserCredentialOrmEntity } from '@infrastructure/mikro-orm/entities';
import { withProjectionCheckpoint } from '../projection-helper';

@Injectable()
export class UserCreatedProjector implements DomainEventHandler {
  readonly projectorName = 'UserCreatedProjector';
  readonly eventType = 'user.created';

  constructor(private readonly em: EntityManager) {}

  async handle(event: DomainEvent): Promise<void> {
    const e = event as UserCreatedEvent;

    return await this.em.transactional(async (t) => {
      const result = await withProjectionCheckpoint({
        tem: t,
        projector: this.projectorName,
        aggregateId: event.aggregateId,
        version: event.version,
        apply: async (t) => {
          const tenantRef = t.getReference(TenantOrmEntity, e.payload.tenantId);

          const user = t.create(UserOrmEntity, {
            id: event.aggregateId,
            tenant: tenantRef,
            username: e.payload.username,
            email: e.payload.email,
            emailVerified: e.payload.emailVerified,
            phone: e.payload.phone,
            phoneVerified: e.payload.phoneVerified,
            status: e.payload.status,
          });
          t.persist(user);

          const credential = t.create(UserCredentialOrmEntity, {
            user: user,
            type: e.payload.credential.type,
            secretHash: e.payload.credential.secretHash,
            hashAlg: e.payload.credential.hashAlg,
            hashParams: e.payload.credential.hashParams,
            hashVersion: e.payload.credential.hashVersion,
            enabled: e.payload.credential.enabled,
            expiresAt: e.payload.credential.expiresAt,
          });

          t.persist(credential);
        },
      });
      if (result === 'SKIPPED') return;
      await t.flush();
    });
  }
}
