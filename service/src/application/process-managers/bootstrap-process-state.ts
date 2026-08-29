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

  advance(nextStep: string): void {
    this.assertRunning();
    if (nextStep === this.step) {
      throw new Error('Bootstrap process step must advance');
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

  complete(): void {
    if (this.status === 'completed') {
      return;
    }
    if (this.status !== 'pending' || this.step !== 'completed') {
      throw new Error('Bootstrap process is not ready to complete');
    }

    this.status = 'completed';
    this.lastFailureCode = null;
  }

  private assertRunning(): void {
    if (this.status !== 'running') {
      throw new Error('Bootstrap process is not running');
    }
  }
}
