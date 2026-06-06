import { Injectable } from '@nestjs/common';
import { OperationalMetricsPort } from '@application/ports/operational-metrics.port';
import {
  OperationalCounterDto,
  OperationalLatencyDto,
  OperationalMetricsSnapshotDto,
  type OperationalMetricLabels,
} from '@application/dto/observability.dto';

type CounterEntry = {
  name: string;
  labels: OperationalMetricLabels;
  value: number;
};

type LatencyEntry = {
  name: string;
  labels: OperationalMetricLabels;
  count: number;
  sumMs: number;
  maxMs: number;
};

@Injectable()
export class InMemoryOperationalMetricsAdapter extends OperationalMetricsPort {
  private readonly counters = new Map<string, CounterEntry>();
  private readonly latencies = new Map<string, LatencyEntry>();

  incrementCounter(
    name: string,
    labels: OperationalMetricLabels = {},
    value = 1,
  ): void {
    const normalizedLabels = normalizeLabels(labels);
    const key = metricKey(name, normalizedLabels);
    const current = this.counters.get(key);

    if (!current) {
      this.counters.set(key, {
        name,
        labels: normalizedLabels,
        value,
      });
      return;
    }

    current.value += value;
  }

  observeLatency(
    name: string,
    latencyMs: number,
    labels: OperationalMetricLabels = {},
  ): void {
    const normalizedLabels = normalizeLabels(labels);
    const key = metricKey(name, normalizedLabels);
    const current = this.latencies.get(key);
    const safeLatencyMs = Math.max(0, latencyMs);

    if (!current) {
      this.latencies.set(key, {
        name,
        labels: normalizedLabels,
        count: 1,
        sumMs: safeLatencyMs,
        maxMs: safeLatencyMs,
      });
      return;
    }

    current.count += 1;
    current.sumMs += safeLatencyMs;
    current.maxMs = Math.max(current.maxMs, safeLatencyMs);
  }

  snapshot(): OperationalMetricsSnapshotDto {
    return OperationalMetricsSnapshotDto.of({
      counters: [...this.counters.values()]
        .sort(compareMetricEntries)
        .map((counter) =>
          OperationalCounterDto.of({
            name: counter.name,
            labels: counter.labels,
            value: counter.value,
          }),
        ),
      latencies: [...this.latencies.values()]
        .sort(compareMetricEntries)
        .map((latency) =>
          OperationalLatencyDto.of({
            name: latency.name,
            labels: latency.labels,
            count: latency.count,
            sumMs: latency.sumMs,
            avgMs: latency.sumMs / latency.count,
            maxMs: latency.maxMs,
          }),
        ),
    });
  }
}

function normalizeLabels(
  labels: OperationalMetricLabels,
): OperationalMetricLabels {
  return Object.fromEntries(
    Object.entries(labels).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function metricKey(name: string, labels: OperationalMetricLabels): string {
  return JSON.stringify({ name, labels });
}

function compareMetricEntries(
  left: { name: string; labels: OperationalMetricLabels },
  right: { name: string; labels: OperationalMetricLabels },
): number {
  return metricKey(left.name, left.labels).localeCompare(
    metricKey(right.name, right.labels),
  );
}
