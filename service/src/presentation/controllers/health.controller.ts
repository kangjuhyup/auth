import { Controller, Get } from '@nestjs/common';
import { ObservabilityQueryPort } from '@application/queries/ports/observability-query.port';
import { ApiTags } from '@nestjs/swagger';
import {
  ApiOkSchema,
  OpenApiResponseSchemas,
} from '@presentation/openapi-response';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(private readonly observabilityQuery: ObservabilityQueryPort) {}

  @Get('health')
  @ApiOkSchema('Get liveness status', OpenApiResponseSchemas.health)
  check() {
    return this.observabilityQuery.getHealth();
  }

  @Get('ready')
  @ApiOkSchema('Get readiness status', OpenApiResponseSchemas.readiness)
  readiness() {
    return this.observabilityQuery.getReadiness();
  }

  @Get('metrics')
  @ApiOkSchema('Get operational metrics', OpenApiResponseSchemas.metrics)
  metrics() {
    return this.observabilityQuery.getMetrics();
  }
}
