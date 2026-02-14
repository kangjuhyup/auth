import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import type { DomainEvent } from '@domain/events';
import type { DomainEventHandler } from '@application/command/ports/domain-event-handler';
import { UserOrmEntity } from '@infrastructure/mikro-orm/entities/user';
import { UserCredentialOrmEntity } from '@infrastructure/mikro-orm/entities/user-credential';
import { withProjectionCheckpoint } from '../projection-helper';
import { UserPasswordChangedEvent } from '@domain/events/user/user-password-change.event';

@Injectable()
export class UserPasswordChangedProjector implements DomainEventHandler {
  readonly projectorName = 'UserPasswordChangedProjector';
  readonly eventType = 'user.password_changed';

  constructor(private readonly em: EntityManager) {}

  async handle(event: DomainEvent): Promise<void> {
    const e = event as UserPasswordChangedEvent;

    await this.em.transactional(async (t) => {
      const result = await withProjectionCheckpoint({
        tem: t,
        projector: this.projectorName,
        aggregateId: event.aggregateId,
        version: event.version,
        apply: async (tem) => {
          // user reference
          const userRef = tem.getReference(UserOrmEntity, event.aggregateId);

          // 1) 기존 password credential 비활성화
          const prev = await tem.findOne(UserCredentialOrmEntity, {
            user: userRef,
            type: 'password',
            enabled: true,
          });

          if (prev) {
            prev.enabled = false;
            prev.expiresAt = e.payload.changedAt;
          }

          // 2) 새 password credential insert
          const cred = tem.create(UserCredentialOrmEntity, {
            user: userRef,
            type: e.payload.credential.type,
            secretHash: e.payload.credential.secretHash,
            hashAlg: e.payload.credential.hashAlg,
            hashParams: e.payload.credential.hashParams,
            hashVersion: e.payload.credential.hashVersion,
            enabled: e.payload.credential.enabled,
            expiresAt: e.payload.credential.expiresAt,
          });

          tem.persist(cred);
        },
      });

      if (result === 'SKIPPED') return;
      await t.flush();
    });
  }
}
