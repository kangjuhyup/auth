import { Injectable } from '@nestjs/common';
import {
  EntityManager,
  LockMode,
  MikroORM,
  RequestContext,
  UniqueConstraintViolationException,
} from '@mikro-orm/core';
import {
  BootstrapProcessState,
  toBootstrapFailureCode,
} from '@application/process-managers/bootstrap-process-state';
import { BootstrapProcessRepository } from '@application/process-managers/ports/bootstrap-process.repository';
import { BootstrapProcessOrmEntity } from '../mikro-orm/entities/bootstrap-process';

@Injectable()
export class BootstrapProcessRepositoryImpl implements BootstrapProcessRepository {
  constructor(private readonly orm: MikroORM) {}

  async withLockedState<T>(
    params: { processKey: string; initialStep: string },
    work: (state: BootstrapProcessState) => Promise<T>,
  ): Promise<T> {
    const em = this.orm.em.fork();

    return RequestContext.create(em, async () => {
      try {
        return await em.transactional((transactionalEm) =>
          this.executeLocked(transactionalEm, params, work, false),
        );
      } catch (error) {
        if (!(error instanceof UniqueConstraintViolationException)) {
          throw error;
        }

        return em.transactional((transactionalEm) =>
          this.executeLocked(transactionalEm, params, work, true),
        );
      }
    });
  }

  private async executeLocked<T>(
    em: EntityManager,
    params: { processKey: string; initialStep: string },
    work: (state: BootstrapProcessState) => Promise<T>,
    requireExisting: boolean,
  ): Promise<T> {
    let entity = await em.findOne(
      BootstrapProcessOrmEntity,
      { processKey: params.processKey },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );

    if (!entity) {
      if (requireExisting) {
        throw new Error('Bootstrap process insert race could not be resolved');
      }

      entity = new BootstrapProcessOrmEntity();
      entity.processKey = params.processKey;
      entity.step = params.initialStep;
      entity.status = 'pending';
      entity.retryCount = 0;
      entity.lastFailureCode = null;
      em.persist(entity);
      await em.flush();
    }

    const state = BootstrapProcessState.rehydrate({
      processKey: entity.processKey,
      step: entity.step,
      status: entity.status,
      retryCount: entity.retryCount,
      lastFailureCode:
        entity.lastFailureCode === null
          ? null
          : toBootstrapFailureCode(entity.lastFailureCode),
    });
    const result = await work(state);

    entity.step = state.step;
    entity.status = state.status;
    entity.retryCount = state.retryCount;
    entity.lastFailureCode = state.lastFailureCode;
    await em.flush();

    return result;
  }
}
