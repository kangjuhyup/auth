import {
  LockMode,
  RequestContext,
  UniqueConstraintViolationException,
  type EntityManager,
  type MikroORM,
} from '@mikro-orm/core';
import { BootstrapStepRunner } from '@application/process-managers/bootstrap-step-runner';
import { BootstrapProcessOrmEntity } from '@infrastructure/mikro-orm/entities/bootstrap-process';
import { BootstrapProcessRepositoryImpl } from '@infrastructure/repositories/bootstrap-process.repository.impl';

type EntityManagerMock = {
  findOne: jest.Mock;
  persist: jest.Mock;
  flush: jest.Mock;
  transactional: jest.Mock;
};

describe('BootstrapProcessRepositoryImpl', () => {
  let requestContextSpy: jest.SpyInstance;

  beforeEach(() => {
    requestContextSpy = jest
      .spyOn(RequestContext, 'create')
      .mockImplementation((_em, work) => work());
  });

  afterEach(() => {
    requestContextSpy.mockRestore();
  });

  function createEntity(
    overrides: Partial<BootstrapProcessOrmEntity> = {},
  ): BootstrapProcessOrmEntity {
    return Object.assign(new BootstrapProcessOrmEntity(), {
      processKey: 'bootstrap:acme:v1',
      step: 'tenant',
      status: 'pending',
      retryCount: 0,
      lastFailureCode: null,
      createdAt: new Date('2026-08-29T00:00:00.000Z'),
      updatedAt: new Date('2026-08-29T00:00:00.000Z'),
      ...overrides,
    });
  }

  function createTransactionManager(): EntityManagerMock {
    return {
      findOne: jest.fn(),
      persist: jest.fn(),
      flush: jest.fn().mockResolvedValue(undefined),
      transactional: jest.fn(),
    };
  }

  function createRepository(transactionManagers: EntityManagerMock[]): {
    repository: BootstrapProcessRepositoryImpl;
    fork: jest.Mock;
    transactional: jest.Mock;
  } {
    const transactional = jest.fn();
    transactionManagers.forEach((transactionManager) => {
      transactional.mockImplementationOnce(
        async (work: (em: EntityManager) => Promise<unknown>) =>
          work(transactionManager as unknown as EntityManager),
      );
    });
    const forkedEntityManager = { transactional };
    const fork = jest.fn().mockReturnValue(forkedEntityManager);
    const orm = { em: { fork } } as unknown as MikroORM;

    return {
      repository: new BootstrapProcessRepositoryImpl(orm),
      fork,
      transactional,
    };
  }

  it('locks and persists mutation of an existing process state', async () => {
    const entity = createEntity();
    const entityManager = createTransactionManager();
    entityManager.findOne.mockResolvedValue(entity);
    const { repository, fork, transactional } = createRepository([
      entityManager,
    ]);

    await repository.withLockedState(
      { processKey: 'bootstrap:acme:v1', initialStep: 'tenant' },
      async (state) => {
        state.beginAttempt();
        state.advance('tenant', 'completed', ['tenant', 'completed']);
      },
    );

    expect(fork).toHaveBeenCalledTimes(1);
    expect(requestContextSpy).toHaveBeenCalledTimes(1);
    expect(transactional).toHaveBeenCalledTimes(1);
    expect(entityManager.findOne).toHaveBeenCalledWith(
      BootstrapProcessOrmEntity,
      { processKey: 'bootstrap:acme:v1' },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );
    expect(entity.step).toBe('completed');
    expect(entity.status).toBe('pending');
    expect(entityManager.flush).toHaveBeenCalledTimes(1);
  });

  it('inserts and flushes a missing process before executing work', async () => {
    const entityManager = createTransactionManager();
    entityManager.findOne.mockResolvedValue(null);
    const work = jest.fn(async (state) => {
      state.beginAttempt();
      state.advance('tenant', 'completed', ['tenant', 'completed']);
    });
    const { repository } = createRepository([entityManager]);

    await repository.withLockedState(
      { processKey: 'bootstrap:acme:v1', initialStep: 'tenant' },
      work,
    );

    const entity = entityManager.persist.mock
      .calls[0][0] as BootstrapProcessOrmEntity;
    expect(entity.processKey).toBe('bootstrap:acme:v1');
    expect(entity.step).toBe('completed');
    expect(entity.status).toBe('pending');
    expect(entityManager.flush).toHaveBeenCalledTimes(2);
    expect(entityManager.flush.mock.invocationCallOrder[0]).toBeLessThan(
      work.mock.invocationCallOrder[0],
    );
  });

  it('re-reads with a lock after an insert race without executing work twice', async () => {
    const losingEntityManager = createTransactionManager();
    losingEntityManager.findOne.mockResolvedValue(null);
    losingEntityManager.flush.mockRejectedValueOnce(
      new UniqueConstraintViolationException(new Error('duplicate key')),
    );
    const winningEntity = createEntity();
    const retryEntityManager = createTransactionManager();
    retryEntityManager.findOne.mockResolvedValue(winningEntity);
    const work = jest.fn(async (state) => {
      state.beginAttempt();
      state.advance('tenant', 'completed', ['tenant', 'completed']);
    });
    const { repository, transactional } = createRepository([
      losingEntityManager,
      retryEntityManager,
    ]);

    await repository.withLockedState(
      { processKey: 'bootstrap:acme:v1', initialStep: 'tenant' },
      work,
    );

    expect(transactional).toHaveBeenCalledTimes(2);
    expect(work).toHaveBeenCalledTimes(1);
    expect(retryEntityManager.findOne).toHaveBeenCalledWith(
      BootstrapProcessOrmEntity,
      { processKey: 'bootstrap:acme:v1' },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );
    expect(winningEntity.step).toBe('completed');
    expect(retryEntityManager.flush).toHaveBeenCalledTimes(1);
  });

  it('does not replay work when a unique error occurs after callback entry', async () => {
    const firstEntityManager = createTransactionManager();
    firstEntityManager.findOne.mockResolvedValue(createEntity());
    const retryEntityManager = createTransactionManager();
    retryEntityManager.findOne.mockResolvedValue(createEntity());
    const callbackError = new UniqueConstraintViolationException(
      new Error('callback unique failure'),
    );
    const work = jest
      .fn()
      .mockRejectedValueOnce(callbackError)
      .mockResolvedValueOnce(undefined);
    const { repository, transactional } = createRepository([
      firstEntityManager,
      retryEntityManager,
    ]);

    await expect(
      repository.withLockedState(
        { processKey: 'bootstrap:acme:v1', initialStep: 'tenant' },
        work,
      ),
    ).rejects.toBe(callbackError);

    expect(work).toHaveBeenCalledTimes(1);
    expect(transactional).toHaveBeenCalledTimes(1);
  });

  it('persists a sanitized failure without raw exception details', async () => {
    const entity = createEntity();
    const entityManager = createTransactionManager();
    entityManager.findOne.mockResolvedValue(entity);
    const { repository } = createRepository([entityManager]);
    const runner = new BootstrapStepRunner(repository);

    await expect(
      runner.run({
        processKey: 'bootstrap:acme:v1',
        initialStep: 'tenant',
        expectedStep: 'tenant',
        nextStep: 'completed',
        steps: ['tenant', 'completed'],
        work: jest
          .fn()
          .mockRejectedValue(
            new Error('password=secret database.internal/postgres'),
          ),
      }),
    ).rejects.toMatchObject({ code: 'BOOTSTRAP_STEP_FAILED' });

    expect(entity.status).toBe('failed');
    expect(entity.retryCount).toBe(1);
    expect(entity.lastFailureCode).toBe('BOOTSTRAP_STEP_FAILED');
    expect(JSON.stringify(entity)).not.toContain('secret');
    expect(JSON.stringify(entity)).not.toContain('database.internal');
    expect(entityManager.flush).toHaveBeenCalledTimes(1);
  });
});
