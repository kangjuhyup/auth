import { ProjectionCheckpointOrmEntity } from '@infrastructure/mikro-orm/entities/projection-check-point';
import { EntityManager, LockMode } from '@mikro-orm/core';

export type CheckpointOptions = {
  /**
   * true면 event.version이 lastVersion+1이 아닐 때 에러를 던져 out-of-order를 막는다.
   * - eventBus가 aggregate별로 version 순서를 보장하는 경우에만 켜는 걸 추천.
   */
  enforceSequential?: boolean;
};

/**
 * @description projection 적용 전에 checkpoint를 확인하고 적용한다.
 * @param args
 * @returns
 * @example
 * const result = await withProjectionCheckpoint({
 *   tem: tem,
 *   projector: 'UserCreatedProjector',
 *   aggregateId: '123',
 *   version: 1,
 * });
 */
export async function withProjectionCheckpoint<T>(args: {
  tem: EntityManager;
  projector: string;
  aggregateId: string;
  version: number;
  options?: CheckpointOptions;
  apply: (tem: EntityManager) => Promise<T>;
}): Promise<T | 'SKIPPED'> {
  const { tem, projector, aggregateId, version, options, apply } = args;
  const enforceSequential = options?.enforceSequential ?? true;

  // 1) checkpoint row lock
  let cp = await tem.findOne(
    ProjectionCheckpointOrmEntity,
    { projector, aggregateId },
    { lockMode: LockMode.PESSIMISTIC_WRITE },
  );

  if (!cp) {
    cp = tem.create(ProjectionCheckpointOrmEntity, {
      projector,
      aggregateId,
      lastVersion: 0,
    });
    tem.persist(cp);
    // flush는 전체 트랜잭션 마지막에 해도 OK
  }

  // 2) 중복 이벤트 스킵
  if (cp.lastVersion >= version) return 'SKIPPED';

  // 3) (선택) out-of-order 감지
  if (enforceSequential && version !== cp.lastVersion + 1) {
    throw new Error(
      `OutOfOrderEvent projector=${projector} aggregateId=${aggregateId} expected=${cp.lastVersion + 1} got=${version}`,
    );
  }

  // 4) 실제 projection 적용
  const result = await apply(tem);

  // 5) checkpoint 갱신
  cp.lastVersion = version;
  tem.persist(cp);

  return result;
}
