import {
  type BootstrapFailureCode,
  toBootstrapFailureCode,
} from './bootstrap-process-state';
import { BootstrapProcessRepository } from './ports/bootstrap-process.repository';

export class BootstrapProcessError extends Error {
  readonly code: BootstrapFailureCode;

  constructor(code: BootstrapFailureCode) {
    super(code);
    this.name = 'BootstrapProcessError';
    this.code = code;
  }
}

export class BootstrapStepRunner {
  constructor(private readonly repository: BootstrapProcessRepository) {}

  async run(params: {
    processKey: string;
    initialStep: string;
    expectedStep: string;
    nextStep: string;
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
        if (
          state.status === 'completed' ||
          state.step !== params.expectedStep
        ) {
          return;
        }

        state.beginAttempt();
        try {
          await params.work();
          state.advance(params.nextStep);
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
}
