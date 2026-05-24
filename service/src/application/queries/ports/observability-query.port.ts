import type {
  HealthStatusDto,
  OperationalMetricsSnapshotDto,
  ReadinessStatusDto,
} from '@application/dto/observability.dto';

export abstract class ObservabilityQueryPort {
  abstract getHealth(): HealthStatusDto;
  abstract getReadiness(): Promise<ReadinessStatusDto>;
  abstract getMetrics(): OperationalMetricsSnapshotDto;
}
