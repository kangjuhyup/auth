import type Provider from 'oidc-provider';
import type { OperationalMetricsPort } from '@application/ports/operational-metrics.port';

const MAX_STABLE_REFRESH_ATTEMPTS = 3;

type ProviderEntry = Readonly<{
  provider: Provider;
  revision?: string;
  checkedAt: number;
}>;

export type OidcProviderRegistryOptions = Readonly<{
  resolveRevision?: (tenantCode: string) => Promise<string>;
  revisionPollIntervalMs?: number;
  now?: () => number;
}>;

export class OidcProviderRegistry {
  private readonly providers = new Map<string, ProviderEntry>();
  private readonly refreshes = new Map<string, Promise<Provider>>();
  private readonly resolveRevision?: (tenantCode: string) => Promise<string>;
  private readonly revisionPollIntervalMs: number;
  private readonly now: () => number;

  constructor(
    private readonly create: (tenantCode: string) => Promise<Provider>,
    private readonly metrics?: OperationalMetricsPort,
    options: OidcProviderRegistryOptions = {},
  ) {
    this.resolveRevision = options.resolveRevision;
    this.revisionPollIntervalMs = options.revisionPollIntervalMs ?? 1_000;
    this.now = options.now ?? Date.now;

    if (
      !Number.isInteger(this.revisionPollIntervalMs) ||
      this.revisionPollIntervalMs < 0 ||
      this.revisionPollIntervalMs > 60_000
    ) {
      throw new Error('OIDC_PROVIDER_CONFIG_POLL_INTERVAL_MS_INVALID');
    }
  }

  get(tenantCode: string): Promise<Provider> {
    const cached = this.providers.get(tenantCode);
    if (
      cached &&
      (!this.resolveRevision ||
        this.now() - cached.checkedAt < this.revisionPollIntervalMs)
    ) {
      this.record('provider_cache_hit_total', tenantCode);
      return Promise.resolve(cached.provider);
    }

    const refreshing = this.refreshes.get(tenantCode);
    if (refreshing) {
      this.record('provider_cache_hit_total', tenantCode);
      return refreshing;
    }

    if (!cached) {
      this.record('provider_cache_miss_total', tenantCode);
    }

    const trackedRefresh = this.reconcile(tenantCode).finally(() => {
      if (this.refreshes.get(tenantCode) === trackedRefresh) {
        this.refreshes.delete(tenantCode);
      }
    });
    this.refreshes.set(tenantCode, trackedRefresh);
    return trackedRefresh;
  }

  private async reconcile(tenantCode: string): Promise<Provider> {
    if (!this.resolveRevision) {
      return this.createAndInstall(tenantCode);
    }

    let expectedRevision: string;
    try {
      expectedRevision = await this.resolveRevision(tenantCode);
    } catch {
      this.record('provider_revision_check_failure_total', tenantCode);
      throw new Error('OIDC provider configuration revision check failed');
    }

    for (let attempt = 0; attempt < MAX_STABLE_REFRESH_ATTEMPTS; attempt += 1) {
      const current = this.providers.get(tenantCode);
      if (current?.revision === expectedRevision) {
        this.providers.set(tenantCode, {
          ...current,
          checkedAt: this.now(),
        });
        this.record('provider_cache_hit_total', tenantCode);
        return current.provider;
      }

      if (attempt === 0 && current) {
        this.record('provider_configuration_refresh_total', tenantCode);
      }

      const candidate = await this.create(tenantCode);
      this.record('provider_created_total', tenantCode);

      let observedRevision: string;
      try {
        observedRevision = await this.resolveRevision(tenantCode);
      } catch {
        this.record('provider_revision_check_failure_total', tenantCode);
        throw new Error('OIDC provider configuration refresh failed');
      }

      if (observedRevision === expectedRevision) {
        this.providers.set(tenantCode, {
          provider: candidate,
          revision: observedRevision,
          checkedAt: this.now(),
        });
        return candidate;
      }

      this.record('provider_refresh_candidate_discarded_total', tenantCode);
      expectedRevision = observedRevision;
    }

    throw new Error('OIDC provider configuration changed during refresh');
  }

  private async createAndInstall(tenantCode: string): Promise<Provider> {
    const provider = await this.create(tenantCode);
    this.providers.set(tenantCode, {
      provider,
      checkedAt: this.now(),
    });
    this.record('provider_created_total', tenantCode);
    return provider;
  }

  private record(metric: string, tenantCode: string): void {
    this.metrics?.incrementCounter(metric, { tenantCode });
  }
}
