import {
  Logger,
  type BeforeApplicationShutdown,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import type { OidcCleanupOptions } from './oidc-cleanup.config';

type CleanupStore = {
  cleanupBatch(
    cutoff: Date,
    batchSize: number,
  ): Promise<{
    deletedModels: number;
    deletedSessionIndexes: number;
  }>;
};

type CleanupLogger = Pick<Logger, 'log' | 'error'>;

/** Only registered by WorkerModule; the HTTP application never polls. */
export class OidcCleanupWorker
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private timer?: ReturnType<typeof setTimeout>;
  private processing?: Promise<void>;
  private stopped = false;
  private started = false;
  private failures = 0;

  constructor(
    private readonly store: CleanupStore,
    private readonly options: OidcCleanupOptions,
    private readonly logger: CleanupLogger = new Logger(OidcCleanupWorker.name),
  ) {}

  onApplicationBootstrap(): void {
    if (this.started || this.stopped) return;
    this.started = true;
    void this.poll();
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.timer);
    // Drain before MikroORM's application-shutdown hook closes connections.
    await this.processing?.catch(() => undefined);
  }

  runCycle(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    this.processing ??= this.executeCycle().finally(() => {
      this.processing = undefined;
    });
    return this.processing;
  }

  private async poll(): Promise<void> {
    let delay = this.options.intervalMs;
    try {
      await this.runCycle();
      this.failures = 0;
    } catch {
      this.failures = Math.min(this.failures + 1, 5);
      delay = Math.min(this.options.intervalMs * 2 ** this.failures, 3_600_000);
      // Never log ORM exceptions: their messages can contain SQL or payloads.
      this.logger.error(`OIDC cleanup failed; retrying in ${delay}ms`);
    }
    if (!this.stopped) this.timer = setTimeout(() => void this.poll(), delay);
  }

  private async executeCycle(): Promise<void> {
    const startedAt = Date.now();
    const cutoff = new Date(startedAt - this.options.graceMs);
    let models = 0;
    let indexes = 0;
    let batches = 0;
    while (!this.stopped && batches < this.options.maxBatches) {
      if (Date.now() - startedAt >= this.options.maxRunMs) break;
      const result = await this.store.cleanupBatch(
        cutoff,
        this.options.batchSize,
      );
      models += result.deletedModels;
      indexes += result.deletedSessionIndexes;
      batches += 1;
      if (result.deletedModels < this.options.batchSize) break;
    }
    this.logger.log(
      `OIDC cleanup completed models=${models} indexes=${indexes} batches=${batches} elapsedMs=${Date.now() - startedAt}`,
    );
  }
}
