import { Injectable } from '@nestjs/common';
import {
  HealthStatusDto,
  ReadinessStatusDto,
} from '@application/dto/observability.dto';
import { ReadinessCheckPort } from '@application/ports/readiness-check.port';
import { OperationalMetricsPort } from '@application/ports/operational-metrics.port';
import { ObservabilityQueryPort } from '../ports/observability-query.port';

@Injectable()
export class ObservabilityQueryHandler extends ObservabilityQueryPort {
  constructor(
    private readonly readinessCheck: ReadinessCheckPort,
    private readonly metrics: OperationalMetricsPort,
  ) {
    super();
  }

  getHealth(): HealthStatusDto {
    return HealthStatusDto.of({
      status: 'ok',
      uptimeSec: Math.floor(process.uptime()),
    });
  }

  async getReadiness(): Promise<ReadinessStatusDto> {
    const components = await this.readinessCheck.check();
    const status = components.every((component) => component.status === 'ready')
      ? 'ready'
      : 'not_ready';

    return ReadinessStatusDto.of({ status, components });
  }

  getMetrics() {
    return this.metrics.snapshot();
  }
}
