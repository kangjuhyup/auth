export interface E2eCleanupOptions {
  closeTasks: Array<() => Promise<void>>;
  restorers: Array<() => void>;
}

export async function cleanupE2eResources({
  closeTasks,
  restorers,
}: E2eCleanupOptions): Promise<void> {
  const cleanupErrors: unknown[] = [];
  const closeResults = await Promise.allSettled(
    closeTasks.map((closeTask) => closeTask()),
  );

  for (const result of closeResults) {
    if (result.status === 'rejected') {
      cleanupErrors.push(result.reason);
    }
  }

  for (const restore of restorers) {
    try {
      restore();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }

  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, 'E2E cleanup failed');
  }
}
