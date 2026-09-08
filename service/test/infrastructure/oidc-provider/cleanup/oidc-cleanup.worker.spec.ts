import { OidcCleanupWorker } from '@infrastructure/oidc-provider/cleanup/oidc-cleanup.worker';
import { readOidcCleanupOptions } from '@infrastructure/oidc-provider/cleanup/oidc-cleanup.config';

describe('OIDC cleanup worker lifecycle', () => {
  const logger = { log: jest.fn(), error: jest.fn() };
  const options = () => readOidcCleanupOptions(() => undefined);
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-06T00:00:00Z'));
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  it('starts automatically, applies the grace period, and repeats after completion', async () => {
    const store = {
      cleanupBatch: jest
        .fn()
        .mockResolvedValue({ deletedModels: 0, deletedSessionIndexes: 0 }),
    };
    const worker = new OidcCleanupWorker(store, options(), logger);
    worker.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    expect(store.cleanupBatch).toHaveBeenCalledWith(
      new Date('2026-09-05T23:55:00Z'),
      500,
    );
    await jest.advanceTimersByTimeAsync(60_000);
    expect(store.cleanupBatch).toHaveBeenCalledTimes(2);
    await worker.beforeApplicationShutdown();
    await jest.advanceTimersByTimeAsync(120_000);
    expect(store.cleanupBatch).toHaveBeenCalledTimes(2);
  });

  it('limits a backlog by batch count', async () => {
    const store = {
      cleanupBatch: jest
        .fn()
        .mockResolvedValue({ deletedModels: 500, deletedSessionIndexes: 2 }),
    };
    const worker = new OidcCleanupWorker(
      store,
      { ...options(), maxBatches: 2 },
      logger,
    );
    await worker.runCycle();
    expect(store.cleanupBatch).toHaveBeenCalledTimes(2);
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('models=1000'),
    );
  });

  it('stops launching batches after the cycle time budget', async () => {
    const store = {
      cleanupBatch: jest.fn().mockImplementation(async () => {
        jest.setSystemTime(Date.now() + 5000);
        return { deletedModels: 500, deletedSessionIndexes: 0 };
      }),
    };
    await new OidcCleanupWorker(store, options(), logger).runCycle();
    expect(store.cleanupBatch).toHaveBeenCalledTimes(1);
  });

  it('waits for an in-flight batch on shutdown and never overlaps cycles', async () => {
    let finish!: (value: {
      deletedModels: number;
      deletedSessionIndexes: number;
    }) => void;
    const store = {
      cleanupBatch: jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      ),
    };
    const worker = new OidcCleanupWorker(store, options(), logger);
    worker.onApplicationBootstrap();
    const cycle = worker.runCycle();
    expect(store.cleanupBatch).toHaveBeenCalledTimes(1);
    let stopped = false;
    const stopping = worker.beforeApplicationShutdown().then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);
    finish({ deletedModels: 500, deletedSessionIndexes: 0 });
    await Promise.all([cycle, stopping]);
    await jest.advanceTimersByTimeAsync(120_000);
    expect(store.cleanupBatch).toHaveBeenCalledTimes(1);
  });

  it('logs a sanitized failure and retries with bounded backoff', async () => {
    const store = {
      cleanupBatch: jest
        .fn()
        .mockRejectedValueOnce(new Error('secret SQL token'))
        .mockResolvedValue({ deletedModels: 0, deletedSessionIndexes: 0 }),
    };
    const worker = new OidcCleanupWorker(store, options(), logger);
    worker.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    expect(logger.error).toHaveBeenCalledWith(
      'OIDC cleanup failed; retrying in 120000ms',
    );
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      'secret SQL token',
    );
    await jest.advanceTimersByTimeAsync(120_000);
    expect(store.cleanupBatch).toHaveBeenCalledTimes(2);
    await worker.beforeApplicationShutdown();
  });
});

describe('OIDC cleanup configuration', () => {
  it('has bounded defaults', () => {
    expect(readOidcCleanupOptions(() => undefined)).toEqual({
      intervalMs: 60000,
      graceMs: 300000,
      batchSize: 500,
      maxBatches: 10,
      maxRunMs: 5000,
    });
  });
  it.each(['-1', '0', '1.5', 'NaN', '1001'])(
    'rejects invalid batch size %s',
    (value) => {
      expect(() =>
        readOidcCleanupOptions((key) =>
          key === 'OIDC_CLEANUP_BATCH_SIZE' ? value : undefined,
        ),
      ).toThrow('OIDC_CLEANUP_BATCH_SIZE');
    },
  );
  it('allows explicit conservative settings', () => {
    expect(
      readOidcCleanupOptions((key) =>
        key === 'OIDC_CLEANUP_BATCH_SIZE' ? '100' : undefined,
      ).batchSize,
    ).toBe(100);
  });
});
