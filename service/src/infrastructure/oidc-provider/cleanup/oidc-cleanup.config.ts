export type OidcCleanupOptions = Readonly<{
  intervalMs: number;
  graceMs: number;
  batchSize: number;
  maxBatches: number;
  maxRunMs: number;
}>;

export function readOidcCleanupOptions(
  read: (key: string) => string | undefined,
): OidcCleanupOptions {
  const integer = (key: string, fallback: number, min: number, max: number) => {
    const raw = read(key);
    const value = raw === undefined ? fallback : Number(raw);
    if (!Number.isSafeInteger(value) || value < min || value > max) {
      throw new Error(`Invalid ${key}`);
    }
    return value;
  };
  return {
    intervalMs: integer('OIDC_CLEANUP_INTERVAL_MS', 60_000, 1_000, 3_600_000),
    graceMs: integer('OIDC_CLEANUP_GRACE_MS', 300_000, 1_000, 604_800_000),
    batchSize: integer('OIDC_CLEANUP_BATCH_SIZE', 500, 1, 1_000),
    maxBatches: integer('OIDC_CLEANUP_MAX_BATCHES', 10, 1, 100),
    maxRunMs: integer('OIDC_CLEANUP_MAX_RUN_MS', 5_000, 100, 60_000),
  };
}
