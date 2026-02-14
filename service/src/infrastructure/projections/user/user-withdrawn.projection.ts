import { Injectable } from '@nestjs/common';
import { EntityManager, LockMode } from '@mikro-orm/postgresql';
import type { DomainEvent } from '@domain/events';
import { withProjectionCheckpoint } from '../projection-helper';
import { UserOrmEntity } from '@infrastructure/mikro-orm/entities';
import { UserWithdrawnEvent } from '@domain/events/user/user-withdrawn.event';

@Injectable()
export class UserWithdrawnProjector {
  readonly eventType = 'user.withdrawn';
  private readonly projectorName = 'UserWithdrawnProjector';

  constructor(private readonly em: EntityManager) {}

  async handle(event: DomainEvent): Promise<void> {
    const e = event as UserWithdrawnEvent;

    await this.em.transactional(async (tem) => {
      const res = await withProjectionCheckpoint({
        tem,
        projector: this.projectorName,
        aggregateId: event.aggregateId,
        version: event.version,
        options: { enforceSequential: true },
        apply: async (t) => {
          // read model 업데이트
          const user = await t.findOne(
            UserOrmEntity,
            { id: event.aggregateId },
            { lockMode: LockMode.PESSIMISTIC_WRITE },
          );

          if (!user) {
            // read model이 아직 없으면(비정상) 여기서 생성하지 않는 편이 보통 안전.
            // 필요시 DLQ/알람 처리 권장.
            throw new Error(
              `UserNotFoundForProjection userId=${event.aggregateId}`,
            );
          }

          user.status = 'WITHDRAWN';
          t.persist(user);
        },
      });

      if (res === 'SKIPPED') return;

      await tem.flush();
    });
  }
}
