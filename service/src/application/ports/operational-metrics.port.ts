import type {
  OperationalMetricLabels,
  OperationalMetricsSnapshotDto,
} from '@application/dto/observability.dto';

export abstract class OperationalMetricsPort {
  abstract incrementCounter(
    name: string,
    labels?: OperationalMetricLabels,
    value?: number,
  ): void;

  abstract observeLatency(
    name: string,
    latencyMs: number,
    labels?: OperationalMetricLabels,
  ): void;

  abstract snapshot(): OperationalMetricsSnapshotDto;
}
