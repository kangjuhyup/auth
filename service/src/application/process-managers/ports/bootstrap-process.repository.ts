import type { BootstrapProcessState } from '../bootstrap-process-state';

export abstract class BootstrapProcessRepository {
  abstract withLockedState<T>(
    params: { processKey: string; initialStep: string },
    work: (state: BootstrapProcessState) => Promise<T>,
  ): Promise<T>;
}
