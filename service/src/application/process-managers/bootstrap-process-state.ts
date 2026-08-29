export type BootstrapProcessStatus =
  | 'pending'
  | 'running'
  | 'failed'
  | 'completed';

export type BootstrapFailureCode =
  | 'ADMIN_CREDENTIALS_REQUIRED'
  | 'ADMIN_PORTAL_CONFLICT'
  | 'BOOTSTRAP_STEP_FAILED';

const BOOTSTRAP_FAILURE_CODES = new Set<BootstrapFailureCode>([
  'ADMIN_CREDENTIALS_REQUIRED',
  'ADMIN_PORTAL_CONFLICT',
  'BOOTSTRAP_STEP_FAILED',
]);

export function toBootstrapFailureCode(value: unknown): BootstrapFailureCode {
  return BOOTSTRAP_FAILURE_CODES.has(value as BootstrapFailureCode)
    ? (value as BootstrapFailureCode)
    : 'BOOTSTRAP_STEP_FAILED';
}

export class BootstrapProcessState {
  private constructor(
    readonly processKey: string,
    public step: string,
    public status: BootstrapProcessStatus,
    public retryCount: number,
    public lastFailureCode: BootstrapFailureCode | null,
  ) {}

  static start(processKey: string, initialStep: string): BootstrapProcessState {
    return new BootstrapProcessState(
      processKey,
      initialStep,
      'pending',
      0,
      null,
    );
  }

  static rehydrate(params: {
    processKey: string;
    step: string;
    status: BootstrapProcessStatus;
    retryCount: number;
    lastFailureCode: BootstrapFailureCode | null;
  }): BootstrapProcessState {
    return new BootstrapProcessState(
      params.processKey,
      params.step,
      params.status,
      params.retryCount,
      params.lastFailureCode,
    );
  }

  beginAttempt(): void {
    if (this.status === 'completed') {
      throw new Error('Bootstrap process is already completed');
    }
    if (this.status === 'running') {
      throw new Error('Bootstrap process is already running');
    }

    this.status = 'running';
    this.lastFailureCode = null;
  }

  shouldRunStep(expectedStep: string, steps: readonly string[]): boolean {
    if (this.status === 'completed') {
      return false;
    }

    const currentIndex = this.stepIndex(this.step, steps);
    const expectedIndex = this.stepIndex(expectedStep, steps);
    if (currentIndex > expectedIndex) {
      return false;
    }
    if (currentIndex < expectedIndex) {
      throw new Error('Bootstrap process is behind the expected step');
    }

    return true;
  }

  advance(
    expectedStep: string,
    nextStep: string,
    steps: readonly string[],
  ): void {
    this.assertRunning();
    const currentIndex = this.stepIndex(this.step, steps);
    const expectedIndex = this.stepIndex(expectedStep, steps);
    const nextIndex = this.stepIndex(nextStep, steps);
    if (currentIndex !== expectedIndex) {
      throw new Error('Bootstrap process step does not match expected step');
    }
    if (nextIndex !== currentIndex + 1) {
      throw new Error('Bootstrap process next step is not a legal successor');
    }

    this.step = nextStep;
    this.status = 'pending';
    this.lastFailureCode = null;
  }

  fail(failureCode: BootstrapFailureCode): void {
    this.assertRunning();

    this.status = 'failed';
    this.retryCount += 1;
    this.lastFailureCode = toBootstrapFailureCode(failureCode);
  }

  complete(expectedStep: string, steps: readonly string[]): void {
    if (this.status === 'completed') {
      return;
    }
    if (this.status !== 'pending') {
      throw new Error('Bootstrap process is not ready to complete');
    }

    const currentIndex = this.stepIndex(this.step, steps);
    const expectedIndex = this.stepIndex(expectedStep, steps);
    if (currentIndex !== expectedIndex || expectedIndex !== steps.length - 1) {
      throw new Error('Bootstrap process completion step is not terminal');
    }

    this.status = 'completed';
    this.lastFailureCode = null;
  }

  private assertRunning(): void {
    if (this.status !== 'running') {
      throw new Error('Bootstrap process is not running');
    }
  }

  private stepIndex(step: string, steps: readonly string[]): number {
    if (steps.length === 0 || new Set(steps).size !== steps.length) {
      throw new Error('Bootstrap process step plan is invalid');
    }

    const index = steps.indexOf(step);
    if (index === -1) {
      throw new Error('Bootstrap process step is not in the step plan');
    }
    return index;
  }
}
