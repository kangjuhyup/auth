import { InMemoryOperationalMetricsAdapter } from '@infrastructure/observability/in-memory-operational-metrics.adapter';

describe('InMemoryOperationalMetricsAdapter', () => {
  it('counter label 순서를 정규화해서 같은 metric으로 누적한다', () => {
    const metrics = new InMemoryOperationalMetricsAdapter();

    metrics.incrementCounter('provider_cache_hit_total', {
      tenantCode: 'acme',
      provider: 'oidc',
    });
    metrics.incrementCounter('provider_cache_hit_total', {
      provider: 'oidc',
      tenantCode: 'acme',
    });

    expect(metrics.snapshot().counters).toEqual([
      {
        name: 'provider_cache_hit_total',
        value: 2,
        labels: {
          provider: 'oidc',
          tenantCode: 'acme',
        },
      },
    ]);
  });

  it('latency count, sum, avg, max를 기록한다', () => {
    const metrics = new InMemoryOperationalMetricsAdapter();

    metrics.observeLatency('token_endpoint_latency_ms', 10, {
      tenantCode: 'acme',
    });
    metrics.observeLatency('token_endpoint_latency_ms', 30, {
      tenantCode: 'acme',
    });

    expect(metrics.snapshot().latencies).toEqual([
      {
        name: 'token_endpoint_latency_ms',
        count: 2,
        sumMs: 40,
        avgMs: 20,
        maxMs: 30,
        labels: {
          tenantCode: 'acme',
        },
      },
    ]);
  });
});
