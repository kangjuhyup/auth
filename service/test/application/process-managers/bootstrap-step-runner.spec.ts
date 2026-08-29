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
  const acmeSteps = ['tenant', 'completed'] as const;

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
      steps: acmeSteps,
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
      steps: acmeSteps,
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
      steps: ['tenant', 'role', 'user', 'completed'],
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
      steps: acmeSteps,
      work: jest.fn().mockRejectedValue(rawError),
    });

    const caughtError = await result.catch((error: unknown) => error);

    expect(caughtError).toMatchObject({
      name: 'BootstrapProcessError',
      message: 'BOOTSTRAP_STEP_FAILED',
      code: 'BOOTSTRAP_STEP_FAILED',
    });
    expect(caughtError).toBeInstanceOf(BootstrapProcessError);
    expect(caughtError).not.toBe(rawError);
    expect(caughtError).not.toHaveProperty('cause');
    expect((caughtError as Error).stack).not.toContain(rawError.message);
    expect(Object.values(caughtError as object)).not.toContain(rawError);
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
        steps: ['tenant', 'role', 'completed'],
        failureCode,
        work: jest.fn().mockRejectedValue(new Error('secret')),
      }),
    ).rejects.toMatchObject({ code: failureCode, message: failureCode });
    expect(state.lastFailureCode).toBe(failureCode);
  });

  it('normalizes an untyped error code before exposing it', () => {
    const error = new BootstrapProcessError('password=secret' as never);

    expect(error.code).toBe('BOOTSTRAP_STEP_FAILED');
    expect(error.message).toBe('BOOTSTRAP_STEP_FAILED');
    expect(error.stack).not.toContain('password=secret');
  });

  it.each([
    {
      name: 'backward',
      currentStep: 'role',
      nextStep: 'tenant',
      steps: ['tenant', 'role', 'user', 'completed'],
    },
    {
      name: 'non-immediate',
      currentStep: 'tenant',
      nextStep: 'user',
      steps: ['tenant', 'role', 'user', 'completed'],
    },
    {
      name: 'unknown',
      currentStep: 'tenant',
      nextStep: 'missing',
      steps: ['tenant', 'role', 'user', 'completed'],
    },
  ])(
    'rejects a $name successor before executing work',
    async ({ currentStep, nextStep, steps }) => {
      const state = BootstrapProcessState.rehydrate({
        processKey: 'bootstrap:admin:v1',
        step: currentStep,
        status: 'pending',
        retryCount: 0,
        lastFailureCode: null,
      });
      const { runner } = createRunner(state);
      const work = jest.fn().mockResolvedValue(undefined);

      await expect(
        runner.run({
          processKey: 'bootstrap:admin:v1',
          initialStep: 'tenant',
          expectedStep: currentStep,
          nextStep,
          steps,
          work,
        }),
      ).rejects.toMatchObject({ code: 'BOOTSTRAP_STEP_FAILED' });

      expect(work).not.toHaveBeenCalled();
      expect(state.step).toBe(currentStep);
      expect(state.status).toBe('pending');
      expect(state.retryCount).toBe(0);
      expect(state.lastFailureCode).toBeNull();
    },
  );

  it('explicitly finalizes a process at the terminal step', async () => {
    const state = BootstrapProcessState.start('bootstrap:acme:v1', 'tenant');
    const { runner } = createRunner(state);

    await runner.run({
      processKey: 'bootstrap:acme:v1',
      initialStep: 'tenant',
      expectedStep: 'tenant',
      nextStep: 'completed',
      steps: acmeSteps,
      work: jest.fn().mockResolvedValue(undefined),
    });
    expect(state.status).toBe('pending');

    await runner.complete({
      processKey: 'bootstrap:acme:v1',
      initialStep: 'tenant',
      expectedStep: 'completed',
      steps: acmeSteps,
    });

    expect(state.step).toBe('completed');
    expect(state.status).toBe('completed');
  });

  it('treats explicit finalization of a completed process as a no-op', async () => {
    const state = BootstrapProcessState.rehydrate({
      processKey: 'bootstrap:acme:v1',
      step: 'completed',
      status: 'completed',
      retryCount: 0,
      lastFailureCode: null,
    });
    const { runner } = createRunner(state);

    await runner.complete({
      processKey: 'bootstrap:acme:v1',
      initialStep: 'tenant',
      expectedStep: 'completed',
      steps: acmeSteps,
    });

    expect(state.status).toBe('completed');
  });
});

describe('BootstrapProcessState', () => {
  it('rejects advance unless an attempt is running', () => {
    const state = BootstrapProcessState.start('bootstrap:acme:v1', 'tenant');

    expect(() =>
      state.advance('tenant', 'completed', ['tenant', 'completed']),
    ).toThrow('Bootstrap process is not running');
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

    state.complete('completed', ['tenant', 'completed']);

    expect(state.status).toBe('completed');
    expect(() => state.beginAttempt()).toThrow(
      'Bootstrap process is already completed',
    );
    expect(state.status).toBe('completed');
  });

  it('rejects a transition to an earlier step in the supplied plan', () => {
    const state = BootstrapProcessState.rehydrate({
      processKey: 'bootstrap:admin:v1',
      step: 'role',
      status: 'pending',
      retryCount: 0,
      lastFailureCode: null,
    });
    state.beginAttempt();

    expect(() =>
      state.advance('role', 'tenant', ['tenant', 'role', 'completed']),
    ).toThrow('Bootstrap process next step is not a legal successor');
    expect(state.step).toBe('role');
    expect(state.status).toBe('running');
  });
});
