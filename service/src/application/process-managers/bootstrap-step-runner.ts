import {
  type BootstrapFailureCode,
  toBootstrapFailureCode,
} from './bootstrap-process-state';
import { BootstrapProcessRepository } from './ports/bootstrap-process.repository';

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
    failureCode?: BootstrapFailureCode;
  }): Promise<void> {
    let caughtFailureCode: BootstrapFailureCode | undefined;

    await this.repository.withLockedState(
      {
        processKey: params.processKey,
        initialStep: params.initialStep,
      },
      async (state) => {
        let shouldRun: boolean;
        try {
          shouldRun = state.shouldRunStep(
            params.expectedStep,
            params.nextStep,
            params.steps,
          );
        } catch {
          caughtFailureCode = 'BOOTSTRAP_STEP_FAILED';
          return;
        }
        if (!shouldRun) {
          return;
        }

        state.beginAttempt();
        try {
          await params.work();
          state.advance(params.expectedStep, params.nextStep, params.steps);
        } catch {
          caughtFailureCode = toBootstrapFailureCode(params.failureCode);
          state.fail(caughtFailureCode);
        }
      },
    );

    if (caughtFailureCode) {
      throw new BootstrapProcessError(caughtFailureCode);
    }
  }

  async complete(params: {
    processKey: string;
    initialStep: string;
    expectedStep: string;
    steps: readonly string[];
  }): Promise<void> {
    await this.repository.withLockedState(
      {
        processKey: params.processKey,
        initialStep: params.initialStep,
      },
      async (state) => {
        state.complete(params.expectedStep, params.steps);
      },
    );
  }
}
