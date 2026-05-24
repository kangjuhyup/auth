import type { ReadinessComponentDto } from '@application/dto/observability.dto';

export abstract class ReadinessCheckPort {
  abstract check(): Promise<ReadinessComponentDto[]>;
}
