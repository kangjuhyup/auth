import {
  BootstrapProcessState,
  type BootstrapFailureCode,
} from '@application/process-managers/bootstrap-process-state';
import {
  BootstrapProcessError,
  BootstrapStepRunner,
} from '@application/process-managers/bootstrap-step-runner';
import type { BootstrapProcessRepository } from '@application/process-managers/ports/bootstrap-process.repository';

describe('BootstrapStepRunner', () => {
  function createRunner(state: BootstrapProcessState): {
    runner: BootstrapStepRunner;
    repository: jest.Mocked<BootstrapProcessRepository>;
  } {
    const repository = {
      withLockedState: jest.fn(async (_params, work) => work(state)),
    } as jest.Mocked<BootstrapProcessRepository>;

    return {
      runner: new BootstrapStepRunner(repository),
      repository,
    };
  }

  it('advances one matching step after successful work', async () => {
    const state = BootstrapProcessState.start('bootstrap:acme:v1', 'tenant');
    const { runner } = createRunner(state);
    const work = jest.fn().mockResolvedValue(undefined);

    await runner.run({
      processKey: 'bootstrap:acme:v1',
      initialStep: 'tenant',
      expectedStep: 'tenant',
      nextStep: 'completed',
      work,
    });

    expect(work).toHaveBeenCalledTimes(1);
    expect(state.step).toBe('completed');
    expect(state.status).toBe('pending');
    expect(state.retryCount).toBe(0);
    expect(state.lastFailureCode).toBeNull();
  });

  it('does not execute work for a completed process', async () => {
    const state = BootstrapProcessState.rehydrate({
      processKey: 'bootstrap:acme:v1',
      step: 'completed',
      status: 'completed',
      retryCount: 0,
      lastFailureCode: null,
    });
    const { runner } = createRunner(state);
    const work = jest.fn().mockResolvedValue(undefined);

    await runner.run({
      processKey: 'bootstrap:acme:v1',
      initialStep: 'tenant',
      expectedStep: 'tenant',
      nextStep: 'completed',
      work,
    });

    expect(work).not.toHaveBeenCalled();
    expect(state.status).toBe('completed');
  });

  it('does not execute work after the expected step has already advanced', async () => {
    const state = BootstrapProcessState.rehydrate({
      processKey: 'bootstrap:admin:v1',
      step: 'role',
      status: 'pending',
      retryCount: 0,
      lastFailureCode: null,
    });
    const { runner } = createRunner(state);
    const work = jest.fn().mockResolvedValue(undefined);

    await runner.run({
      processKey: 'bootstrap:admin:v1',
      initialStep: 'tenant',
      expectedStep: 'tenant',
      nextStep: 'role',
      work,
    });

    expect(work).not.toHaveBeenCalled();
    expect(state.step).toBe('role');
  });

  it('persists only a safe fallback code before rejecting unexpected errors', async () => {
    const state = BootstrapProcessState.start('bootstrap:acme:v1', 'tenant');
    const { runner } = createRunner(state);
    const rawError = new Error(
      'password=secret database.internal/postgres?token=secret',
    );

    const result = runner.run({
      processKey: 'bootstrap:acme:v1',
      initialStep: 'tenant',
      expectedStep: 'tenant',
      nextStep: 'completed',
      work: jest.fn().mockRejectedValue(rawError),
    });

    await expect(result).rejects.toMatchObject({
      name: 'BootstrapProcessError',
      message: 'BOOTSTRAP_STEP_FAILED',
      code: 'BOOTSTRAP_STEP_FAILED',
    });
    await expect(result).rejects.toBeInstanceOf(BootstrapProcessError);
    expect(state.status).toBe('failed');
    expect(state.retryCount).toBe(1);
    expect(state.lastFailureCode).toBe('BOOTSTRAP_STEP_FAILED');
    expect(JSON.stringify(state)).not.toContain('secret');
    expect(JSON.stringify(state)).not.toContain('database.internal');
  });

  it.each<BootstrapFailureCode>([
    'ADMIN_CREDENTIALS_REQUIRED',
    'ADMIN_PORTAL_CONFLICT',
  ])('persists the supplied known failure code %s', async (failureCode) => {
    const state = BootstrapProcessState.start('bootstrap:admin:v1', 'tenant');
    const { runner } = createRunner(state);

    await expect(
      runner.run({
        processKey: 'bootstrap:admin:v1',
        initialStep: 'tenant',
        expectedStep: 'tenant',
        nextStep: 'role',
        failureCode,
        work: jest.fn().mockRejectedValue(new Error('secret')),
      }),
    ).rejects.toMatchObject({ code: failureCode, message: failureCode });
    expect(state.lastFailureCode).toBe(failureCode);
  });
});

describe('BootstrapProcessState', () => {
  it('rejects advance unless an attempt is running', () => {
    const state = BootstrapProcessState.start('bootstrap:acme:v1', 'tenant');

    expect(() => state.advance('completed')).toThrow(
      'Bootstrap process is not running',
    );
    expect(state.step).toBe('tenant');
    expect(state.status).toBe('pending');
  });

  it('rejects mutation after completion', () => {
    const state = BootstrapProcessState.rehydrate({
      processKey: 'bootstrap:acme:v1',
      step: 'completed',
      status: 'pending',
      retryCount: 0,
      lastFailureCode: null,
    });

    state.complete();

    expect(state.status).toBe('completed');
    expect(() => state.beginAttempt()).toThrow(
      'Bootstrap process is already completed',
    );
    expect(state.status).toBe('completed');
  });
});
