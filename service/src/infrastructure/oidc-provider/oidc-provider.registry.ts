import type Provider from 'oidc-provider';
import type { OperationalMetricsPort } from '@application/ports/operational-metrics.port';

export class OidcProviderRegistry {
  private readonly providers = new Map<string, Promise<Provider>>();

  constructor(
    private readonly create: (tenantCode: string) => Promise<Provider>,
    private readonly metrics?: OperationalMetricsPort,
  ) {}

  get(tenantCode: string): Promise<Provider> {
    let provider = this.providers.get(tenantCode);

    if (!provider) {
      this.metrics?.incrementCounter('provider_cache_miss_total', {
        tenantCode,
      });
      provider = this.create(tenantCode).catch((error) => {
        this.providers.delete(tenantCode);
        throw error;
      });
      this.metrics?.incrementCounter('provider_created_total', {
        tenantCode,
      });
      this.providers.set(tenantCode, provider);
    } else {
      this.metrics?.incrementCounter('provider_cache_hit_total', {
        tenantCode,
      });
    }

    return provider;
  }
}
