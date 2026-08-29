import {
  type BootstrapFailureCode,
  toBootstrapFailureCode,
} from './bootstrap-process-state';
import { BootstrapProcessRepository } from './ports/bootstrap-process.repository';

export type BootstrapKnownFailureCode =
  | 'ADMIN_CREDENTIALS_REQUIRED'
  | 'ADMIN_PORTAL_CONFLICT'
  | 'ADMIN_USER_CONFLICT';

const knownFailureTokens = new WeakMap<object, BootstrapKnownFailureCode>();

export function createBootstrapKnownFailure(
  code: BootstrapKnownFailureCode,
): object {
  const token = Object.freeze({});
  if (
    code === 'ADMIN_CREDENTIALS_REQUIRED' ||
    code === 'ADMIN_PORTAL_CONFLICT' ||
    code === 'ADMIN_USER_CONFLICT'
  ) {
    knownFailureTokens.set(token, code);
  }
  return token;
}

export class BootstrapProcessError extends Error {
  readonly code: BootstrapFailureCode;

  constructor(code: BootstrapFailureCode) {
    const safeCode = toBootstrapFailureCode(code);
    super(safeCode);
    this.name = 'BootstrapProcessError';
    this.code = safeCode;
  }
}

export class BootstrapStepRunner {
  constructor(private readonly repository: BootstrapProcessRepository) {}

  async run(params: {
    processKey: string;
    initialStep: string;
    expectedStep: string;
    nextStep: string;
    steps: readonly string[];
    work: () => Promise<void>;
  }): Promise<void> {
    const rollbackToken = Object.freeze({});
    let caughtFailureCode: BootstrapFailureCode | undefined;

    try {
      await this.repository.withLockedState(
        {
          processKey: params.processKey,
          initialStep: params.initialStep,
        },
        async (state) => {
          const shouldRun = state.shouldRunStep(
            params.expectedStep,
            params.nextStep,
            params.steps,
          );
          if (!shouldRun) {
            return;
          }

          const stateBeforeAttempt = {
            step: state.step,
            status: state.status,
            retryCount: state.retryCount,
            lastFailureCode: state.lastFailureCode,
          };
          state.beginAttempt();

          try {
            await params.work();
            state.advance(params.expectedStep, params.nextStep, params.steps);
          } catch (error: unknown) {
            caughtFailureCode = this.knownFailureCode(error);
            state.step = stateBeforeAttempt.step;
            state.status = stateBeforeAttempt.status;
            state.retryCount = stateBeforeAttempt.retryCount;
            state.lastFailureCode = stateBeforeAttempt.lastFailureCode;
            throw rollbackToken;
          }
        },
      );
    } catch (error: unknown) {
      if (error !== rollbackToken || !caughtFailureCode) {
        throw new BootstrapProcessError('BOOTSTRAP_STEP_FAILED');
      }
      const failureCode = caughtFailureCode;

      try {
        await this.repository.withLockedState(
          {
            processKey: params.processKey,
            initialStep: params.initialStep,
          },
          async (state) => {
            if (
              !state.shouldRunStep(
                params.expectedStep,
                params.nextStep,
                params.steps,
              )
            ) {
              return;
            }
            state.beginAttempt();
            state.fail(failureCode);
          },
        );
      } catch {
        throw new BootstrapProcessError('BOOTSTRAP_STEP_FAILED');
      }

      throw new BootstrapProcessError(failureCode);
    }
  }

  async complete(params: {
    processKey: string;
    initialStep: string;
    expectedStep: string;
    steps: readonly string[];
  }): Promise<void> {
    try {
      await this.repository.withLockedState(
        {
          processKey: params.processKey,
          initialStep: params.initialStep,
        },
        async (state) => {
          state.complete(params.expectedStep, params.steps);
        },
      );
    } catch {
      throw new BootstrapProcessError('BOOTSTRAP_STEP_FAILED');
    }
  }

  private knownFailureCode(error: unknown): BootstrapFailureCode {
    if (typeof error === 'object' && error !== null) {
      return knownFailureTokens.get(error) ?? 'BOOTSTRAP_STEP_FAILED';
    }
    return 'BOOTSTRAP_STEP_FAILED';
  }
}
