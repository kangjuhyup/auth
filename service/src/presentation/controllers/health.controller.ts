import { Controller, Get } from '@nestjs/common';
import { ObservabilityQueryPort } from '@application/queries/ports/observability-query.port';

@Controller()
export class HealthController {
  constructor(private readonly observabilityQuery: ObservabilityQueryPort) {}

  @Get('health')
  check() {
    return this.observabilityQuery.getHealth();
  }

  @Get('ready')
  readiness() {
    return this.observabilityQuery.getReadiness();
  }

  @Get('metrics')
  metrics() {
    return this.observabilityQuery.getMetrics();
  }
}
